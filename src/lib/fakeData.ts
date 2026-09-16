// Prototype only — fake data shared by the grid and the public report.

export type Task = { taskId: string; taskTitle: string; taskDescription: string };
export type ProjectWithTasks = {
	projectId: string;
	projectName: string;
	projectColor: string;
	tasks: Task[];
};

export const projectColorPalette = [
	'#28D059',
	'#8A38F5',
	'#E46F86',
	'#FFD73B',
	'#3C65E7',
	'#DC3FB2',
	'#B1B1B1'
	];

export const initialProjectsWithTasks: ProjectWithTasks[] = [
	{
		projectId: 'qqbet',
		projectName: 'QQbet',
		projectColor: '#28D059',
		tasks: [
			{ taskId: 'logo', taskTitle: 'Создание логотипа для нового продукта', taskDescription: '' },
			{ taskId: 'ui', taskTitle: 'Разработка пользовательского интерфейса', taskDescription: '' },
			{
				taskId: 'spin-assets',
				taskTitle: 'Собрать ассеты для Жени в Spin Wheel',
				taskDescription: '– Подготовить изображения для Spin Wheel page\n– Изображения для pop-up'
			},
			{
				taskId: 'jackpot',
				taskTitle: 'Jackpot landing page',
				taskDescription: '– Сделать правки на 2 страницах'
			},
			{ taskId: 'popup-spin', taskTitle: 'Добавление Pop-up Spin Wheel', taskDescription: '– Desktop\n– Mobile' },
			{ taskId: 'brand-guide', taskTitle: 'Брендбук, обновление гайдлайнов', taskDescription: '' }
		]
	},
	{
		projectId: 'back-office',
		projectName: 'Back Office',
		projectColor: '#8A38F5',
		tasks: [
			{
				taskId: 'notifications',
				taskTitle: 'Переработка таблицы Notification',
				taskDescription: '– Создание упрощённой итерации на основе компонентов'
			},
			{ taskId: 'daily', taskTitle: 'Созвон – Daily QQ.bet', taskDescription: '' },
			{ taskId: 'tables', taskTitle: 'Tables', taskDescription: '– Переработать все таблицы в системе' },
			{ taskId: 'profile-data', taskTitle: 'Profile data', taskDescription: '' }
		]
	},
	{
		projectId: 'cyberus',
		projectName: 'Сайберус',
		projectColor: '#E46F86',
		tasks: [
			{
				taskId: 'bonus-iterations',
				taskTitle: 'Bonus Iterations (повторение бонусных кампаний)',
				taskDescription: '– Проработка 3х итераций настройки\n– Презентация решения, обсуждение'
			}
		]
	},
	{
		projectId: 'radiance',
		projectName: 'Radiance',
		projectColor: '#FFD73B',
		tasks: [
			{ taskId: 'call-nastya', taskTitle: 'Созвон – Настя + Давид', taskDescription: '' },
			{ taskId: 'radiance-social', taskTitle: 'Соцсети: макеты на месяц', taskDescription: '' }
		]
	},
	{
		projectId: 'otoswap',
		projectName: 'Otoswap',
		projectColor: '#3C65E7',
		tasks: [
			{ taskId: 'otoswap-app', taskTitle: 'Otoswap: экраны обмена', taskDescription: '' },
			{ taskId: 'otoswap-call', taskTitle: 'Созвон – Саша + Давид', taskDescription: '' }
		]
	},
	{ projectId: 'lead-junkies', projectName: 'Lead Junkies', projectColor: '#DC3FB2', tasks: [] }
];

export function toIsoDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Fake data for the current month only: different tasks in different weeks,
// nothing after the month ends, so the empty state is visible too.
export function buildFakeMonthOfHours(): Record<string, string> {
	const today = new Date();
	const year = today.getFullYear();
	const month = today.getMonth();
	const hours: Record<string, string> = {};

	// [taskId, day of month, hours]
	const fakeEntries: [string, number, string][] = [
		['logo', 1, '3'], ['logo', 2, '2,5'], ['ui', 3, '6'], ['ui', 4, '8'],
		['daily', 1, '0,5'], ['daily', 2, '0,5'], ['daily', 3, '0,5'],
		['bonus-iterations', 8, '5'], ['bonus-iterations', 9, '2,5'],
		['notifications', 9, '4'], ['notifications', 10, '6'], ['notifications', 11, '3'],
		['daily', 8, '0,5'], ['daily', 9, '0,5'],
		['spin-assets', 15, '4'], ['spin-assets', 16, '7'], ['spin-assets', 17, '2'],
		['jackpot', 16, '3'], ['jackpot', 18, '5'],
		['call-nastya', 15, '1'], ['call-nastya', 17, '1,5'],
		['ui', 22, '8'], ['ui', 23, '8'], ['ui', 24, '4'],
		['logo', 24, '3'], ['logo', 25, '6'],
		['daily', 22, '0,5'], ['daily', 23, '0,5'],
		['tables', 2, '4'], ['tables', 3, '2'], ['tables', 10, '5'], ['tables', 11, '3'],
		['profile-data', 4, '2'], ['profile-data', 18, '4'], ['profile-data', 25, '3'],
		['popup-spin', 7, '6'], ['popup-spin', 8, '3'], ['popup-spin', 21, '5'], ['popup-spin', 22, '2'],
		['brand-guide', 11, '4'], ['brand-guide', 12, '6'], ['brand-guide', 29, '7'],
		['radiance-social', 3, '3'], ['radiance-social', 16, '5'], ['radiance-social', 30, '6'],
		['otoswap-app', 7, '2'], ['otoswap-app', 14, '6'], ['otoswap-app', 15, '4'],
		['otoswap-app', 28, '8'], ['otoswap-call', 14, '1'], ['otoswap-call', 28, '1'],
		['call-nastya', 29, '1,5'], ['jackpot', 30, '4'], ['ui', 9, '3'], ['logo', 17, '5']
	];

	const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
	for (const [taskId, dayOfMonth, value] of fakeEntries) {
		if (dayOfMonth > lastDayOfMonth) continue;
		hours[`${taskId}:${toIsoDate(new Date(year, month, dayOfMonth))}`] = value;
	}
	return hours;
}

