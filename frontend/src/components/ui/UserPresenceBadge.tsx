import React from 'react';
import { UserStatus } from '../../store/presenceStore';

interface UserPresenceBadgeProps {
  status: UserStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const UserPresenceBadge: React.FC<UserPresenceBadgeProps> = ({
  status,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const statusColors = {
    online: 'bg-green-500',
    idle: 'bg-yellow-500',
    dnd: 'bg-red-500',
    offline: 'bg-gray-400',
  };

  return (
    <span
      className={`inline-block rounded-full ring-2 ring-white dark:ring-gray-900 ${sizeClasses[size]} ${statusColors[status]}`}
      title={`Status: ${status}`}
    />
  );
};
