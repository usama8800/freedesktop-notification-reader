# Freedesktop Notification Reader
Reads Freedesktop notifications from DBUS 
## Usage
```typescript
import { notificationFrom, notificationHead } from '@usama8800/freedesktop-notification-reader';

// From Application
const chromNoti = await notificationFrom('Chrome');

// With header
const instaNoti = await notificationHead('Instagram');
```
