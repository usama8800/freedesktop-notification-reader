import { spawn } from "child_process";
import EventEmitter from "events";

type DBUSParsedEvent = {
  'data': [arg1: DBUSParsedData],
};

type DBUSDataDict = {
  type: 'dict';
  value: {
    key: string;
    value: DBUSProperty;
  }
};

type DBUSDataArray = {
  type: 'array';
  value: DBUSProperty[];
};

type DBUSProperty = {
  type: 'string';
  value: string;
} | {
  type: 'number';
  value: number;
} | {
  type: 'unknown';
  value: string;
} | DBUSDataArray | DBUSDataDict;

type DBUSParsedData = {
  type: string;
  time: number;
  sender: string;
  destination: string;
  serial: number;
  path: string;
  interface: string;
  member: string;
  properties: DBUSProperty[];
};

class DBUSParser {
  parsed: EventEmitter<DBUSParsedEvent> = new EventEmitter();
  partialData: DBUSParsedData | undefined;
  timeout: any;
  stack: (DBUSDataArray | DBUSDataDict)[] = []

  send(buffer: Buffer) {
    if (this.timeout) clearTimeout(this.timeout);
    this.parse(buffer);
    this.timeout = setTimeout(() => {
      if (this.partialData) this.parsed.emit('data', this.partialData);
      this.partialData = undefined;
      this.timeout = null;
    }, 100);
  }

  parse(buffer: Buffer) {
    const string = buffer.toString();
    const lines = string.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (!line) continue
      if (line.match(/^\w+/)) {
        if (this.partialData) this.parsed.emit('data', this.partialData);
        this.partialData = this.parseFirstLine(line);
        continue;
      }
      if (!this.partialData) continue;
      line = line.trim();
      const data = this.parsePrimitiveLine(line);
      if (data.type !== 'unknown') {
        this.push(data);
        continue;
      }
      if (line.startsWith('dict entry(')) {
        this.stack.push({
          type: 'dict', value: {
            key: '',
            value: { type: 'unknown', value: '' },
          }
        });
      }
      if (line === ')' && this.stack.length) {
        this.push(this.stack.pop()!);
        continue;
      }
      if (line.startsWith('array [')) {
        this.stack.push({ type: 'array', value: [] });
        continue;
      }
      if (line === ']' && this.stack.length) {
        this.push(this.stack.pop()!);
        continue;
      }

      this.push({ type: 'unknown', value: line });
    }
  }

  private parsePrimitiveLine(line: string): DBUSProperty {
    const primitiveMatch = line.match(/(string|uint32|int32|byte) /);
    if (primitiveMatch) {
      const type = primitiveMatch[1];
      const value = line.slice(primitiveMatch.index! + primitiveMatch[0].length);
      if (type === 'string') return { type, value: value.slice(1, -1) };
      return { type: 'number', value: +value };
    } else return { type: 'unknown', value: line };
  }

  private push(data: DBUSProperty) {
    if (this.stack.length) {
      const lastItem = this.stack.at(-1)!;
      if (lastItem.type === 'dict') {
        if (lastItem.value.key === '' && data.type === 'string') lastItem.value.key = data.value;
        else lastItem.value.value = data;
      } else {
        lastItem.value.push(data);
      }
    } else {
      this.partialData!.properties.push(data);
    }
  }

  private parseFirstLine(line: string): DBUSParsedData {
    const timeMatch = line.match(/ time=(\d+\.\d+) /);
    if (!timeMatch) throw new Error('no time in dbus output: ' + line);
    const type = line.slice(0, timeMatch.index);
    line = line.slice(timeMatch.index! + 1);
    const match = line.match(/time=(\d+\.\d+) sender=(.+?) -> destination=(.+?) serial=(\d+) path=(.+?) interface=(.+?) member=(.+)$/);
    if (!match) throw new Error('no match in dbus output: ' + line);
    const [, timeStr, sender, destination, serial, path, _interface, member] = match;
    return {
      type,
      time: +timeStr,
      sender: sender,
      destination: destination,
      serial: +serial,
      path: path,
      interface: _interface,
      member: member,
      properties: [],
    };
  }
}

type Notification = {
  from: string;
  head: string;
  body: string;
  urgency?: number;
  pid?: number
};

/**
 * Retrieves a notification from the DBus.
 *
 * @param {Object} [like] - Optional parameters to filter the notification.
 * @param {string} [like.from] - The sender of the notification.
 * @param {string} [like.head] - The head of the notification.
 * @param {string} [like.body] - The body of the notification.
 * @param {number} [like.urgency] - The urgency level of the notification.
 * @param {number} [like.pid] - The process ID of the notification.
 * @returns {Promise<Notification>} A promise that resolves to the notification.
 */
export async function getNotification(like?: {
  from?: string | RegExp;
  head?: string | RegExp;
  body?: string | RegExp;
  urgency?: number;
  pid?: number;
}) {
  return new Promise<Notification>((resolve, reject) => {
    const monitor = spawn('dbus-monitor', [`interface='org.freedesktop.Notifications'`, '--monitor']);
    const parser = new DBUSParser();

    parser.parsed.on('data', (data) => {
      if (data.member === 'Notify') {
        const notification: Notification = {
          from: data.properties[0].value as any,
          head: data.properties[3].value as any,
          body: data.properties[4].value as any,
          urgency: (data.properties[6] as DBUSDataArray)?.value?.[0]?.value as any,
          pid: (data.properties[6] as DBUSDataArray)?.value?.[1]?.value as any,
        };
        if (like) {
          if (like.from) {
            if (typeof like.from === 'string' && like.from !== notification.from) return;
            if (like.from instanceof RegExp && !like.from.test(notification.from)) return;
          }
          if (like.head) {
            if (typeof like.head === 'string' && like.head !== notification.head) return;
            if (like.head instanceof RegExp && !like.head.test(notification.head)) return;
          }
          if (like.body) {
            if (typeof like.body === 'string' && like.body !== notification.body) return;
            if (like.body instanceof RegExp && !like.body.test(notification.body)) return;
          }
          if (like.urgency && notification.urgency !== like.urgency) return;
          if (like.pid && notification.pid !== like.pid) return;
        }
        resolve(notification);
        monitor.kill();
      }
    });

    monitor.stdout.on('data', (stdout) => {
      parser.send(stdout);
    });

    monitor.stderr.on('data', (data) => {
      reject(data);
      monitor.kill();
    });

    monitor.on('close', (code) => {
      reject(code || 0);
    });
  });
}
