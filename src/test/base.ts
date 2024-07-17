import { expect } from 'chai';
import { spawnSync } from 'child_process';
import { getNotification } from '..';

function sendNotification(body: string, head?: string, from?: string) {
  const args: string[] = [];
  if (from) args.push('-a', from);
  if (head) args.push(head);
  args.push(body);
  const res = spawnSync('notify-send', args);
}

describe('Tests', () => {
  it('Notification any', async function () {
    const promise = getNotification();
    setTimeout(() => sendNotification('Body', 'Head', 'From'));
    const notification = await promise;
    expect(notification.from).to.equal('From');
    expect(notification.head).to.equal('Head');
    expect(notification.body).to.equal('Body');
  });

  it('Notification from', async function () {
    const promise = getNotification({ from: 'From' });
    setTimeout(() => sendNotification('Body', 'Head', 'From'));
    const notification = await promise;
    expect(notification.from).to.equal('From');
    expect(notification.head).to.equal('Head');
    expect(notification.body).to.equal('Body');
  });

  it('Notification head', async function () {
    const promise = getNotification({ head: 'Head' });
    setTimeout(() => sendNotification('Body', 'Head', 'From'));
    const notification = await promise;
    expect(notification.from).to.equal('From');
    expect(notification.head).to.equal('Head');
    expect(notification.body).to.equal('Body');
  });

  it('Notification body regex', async function () {
    const promise = getNotification({ body: /^..dy$/i });
    setTimeout(() => sendNotification('Body', 'Head', 'From'));
    const notification = await promise;
    expect(notification.from).to.equal('From');
    expect(notification.head).to.equal('Head');
    expect(notification.body).to.equal('Body');
  });
});
