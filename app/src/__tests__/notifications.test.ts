import {
  isPushEnabled,
  registerForPushNotificationsAsync,
  sendLocalNotification,
  setPushEnabledOverride,
} from '../services/notifications';

describe('notifications service', () => {
  afterEach(() => {
    setPushEnabledOverride(null);
  });

  it('reports disabled when feature flag is not set to true', async () => {
    setPushEnabledOverride(false);
    expect(isPushEnabled()).toBe(false);

    const token = await registerForPushNotificationsAsync();
    expect(token).toBeNull();

    const dispatched = await sendLocalNotification('Test', 'Body');
    expect(dispatched).toBe(false);
  });

  it('activates placeholder when feature flag is set to true', async () => {
    setPushEnabledOverride(true);
    expect(isPushEnabled()).toBe(true);

    const token = await registerForPushNotificationsAsync();
    expect(token).toBe('exponent-push-token-placeholder');

    const dispatched = await sendLocalNotification('Alert', 'New high value lead');
    expect(dispatched).toBe(true);
  });
});
