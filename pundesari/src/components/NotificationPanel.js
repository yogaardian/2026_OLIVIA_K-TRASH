import React from 'react';
import { useNotification } from '../context/NotificationContext';
import './NotificationPanel.css';

/**
 * Notification Panel Component
 * Displays all active notifications from the notification context
 */
export const NotificationPanel = () => {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="notification-panel">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
        >
          <div className="notification-content">
            {notification.title && (
              <div className="notification-title">{notification.title}</div>
            )}
            <div className="notification-message">{notification.message}</div>
          </div>
          <button
            className="notification-close"
            onClick={() => removeNotification(notification.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationPanel;
