# Freedesktop Notification Reader
Reads Freedesktop notifications from DBUS 
## Usage
```typescript
import { getNotification } from '@usama8800/freedesktop-notification-reader';

// From Application
const chromeNoti = await getNotification({from: 'Chrome'});

// With header
const instaNoti = await getNotification({head: 'Instagram'});

// Regex match on body
const messageNoti = await getNotification({head: 'Instagram', body: /inta_username: /i});
```
