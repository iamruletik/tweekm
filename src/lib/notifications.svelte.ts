// Prototype only — notifications live in memory, shared by every route.

export type StudioNotification = {
	notificationId: string;
	employeeId: string;
	notificationText: string;
	createdAt: string;
	isRead: boolean;
};

// Examples so the bell is not empty on first open.
function seedNotifications(): StudioNotification[] {
	const today = new Date();
	const hoursAgo = (hours: number) =>
		new Date(today.getTime() - hours * 60 * 60 * 1000).toISOString();
	return [
		{
			notificationId: 'seed-merge',
			employeeId: 'david',
			notificationText: 'Даша объединила проекты «ККбет» и «QQbet» — проверьте клиента.',
			createdAt: hoursAgo(3),
			isRead: false
		},
		{
			notificationId: 'seed-vacation',
			employeeId: 'david',
			notificationText: 'Настя просит отпуск: 12–20 числа следующего месяца.',
			createdAt: hoursAgo(20),
			isRead: false
		},
		{
			notificationId: 'seed-hours',
			employeeId: 'david',
			notificationText: 'Марк не заполнил часы за прошлую пятницу.',
			createdAt: hoursAgo(26),
			isRead: true
		},
		{
			notificationId: 'seed-dasha',
			employeeId: 'dasha',
			notificationText: 'Отпуск 12–20 числа согласован.',
			createdAt: hoursAgo(5),
			isRead: false
		}
	];
}

const notifications = $state<{ items: StudioNotification[] }>({ items: seedNotifications() });

export function notificationsFor(employeeId: string): StudioNotification[] {
	return notifications.items.filter((item) => item.employeeId === employeeId);
}

export function unreadCountFor(employeeId: string): number {
	return notificationsFor(employeeId).filter((item) => !item.isRead).length;
}

export function notifyEmployees(employeeIds: string[], notificationText: string) {
	const createdAt = new Date().toISOString();
	for (const employeeId of new Set(employeeIds)) {
		notifications.items = [
			{
				notificationId: `n-${createdAt}-${employeeId}`,
				employeeId,
				notificationText,
				createdAt,
				isRead: false
			},
			...notifications.items
		];
	}
}

export function markNotificationsRead(employeeId: string) {
	notifications.items = notifications.items.map((item) =>
		item.employeeId === employeeId ? { ...item, isRead: true } : item
	);
}
