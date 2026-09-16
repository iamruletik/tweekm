// Prototype only — fake studio-wide data for the boss views.

import { toIsoDate, type Task, type ProjectWithTasks } from '$lib/fakeData';
import { addDays, isWeekend } from '$lib/dates';

export type EmploymentKind = 'staff' | 'outsource';

export type EmployeeStatus = 'active' | 'invited' | 'archived';

export type Employee = {
	employeeId: string;
	employeeName: string;
	employeeRole: string;
	avatarUrl: string;
	// Outsource people have no account — the boss keeps their rows himself.
	employmentKind: EmploymentKind;
	isBoss: boolean;
	employeeStatus: EmployeeStatus;
	// False until an invited person opens the link and sets a password, so
	// un-archiving them puts them back in "invited" rather than "active".
	hasAcceptedInvite: boolean;
	employeeEmail: string;
	employeeNote: string;
	// Boss-only money: a monthly salary for staff, an hourly rate for outsource.
	monthlySalary: number;
	outsourceHourlyRate: number;
	payCurrency: Currency;
};

export type Currency = 'RUB' | 'USD' | 'EUR';

export type Client = {
	clientId: string;
	clientName: string;
	hourlyRate: number;
	currency: Currency;
};

export type StudioProject = {
	projectId: string;
	projectName: string;
	projectColor: string;
	clientId: string | null;
	// Set once the boss merges this project into another one.
	mergedIntoProjectId: string | null;
};

export type StudioTask = Task & {
	projectId: string;
	employeeId: string;
};

export type VacationStatus = 'pending' | 'approved' | 'declined';

export type VacationRequest = {
	vacationId: string;
	employeeId: string;
	fromDate: string;
	toDate: string;
	status: VacationStatus;
};

export const currencySymbols: Record<Currency, string> = {
	RUB: '₽',
	USD: '$',
	EUR: '€'
};

export const employees: Employee[] = [
	{
		employeeId: 'david',
		employeeName: 'David Gordov',
		employeeRole: 'Руководитель студии',
		avatarUrl: 'https://i.pravatar.cc/80?img=12',
		employmentKind: 'staff',
		isBoss: true,
		employeeStatus: 'active',
		hasAcceptedInvite: true,
		employeeEmail: 'david@studio.com',
		employeeNote: 'Собственник студии',
		monthlySalary: 320000,
		outsourceHourlyRate: 0,
		payCurrency: 'RUB'
	},
	{
		employeeId: 'dasha',
		employeeName: 'Даша Кольцова',
		employeeRole: 'Дизайнер',
		avatarUrl: 'https://i.pravatar.cc/80?img=47',
		employmentKind: 'staff',
		isBoss: false,
		employeeStatus: 'active',
		hasAcceptedInvite: true,
		employeeEmail: 'dasha@studio.com',
		employeeNote: 'Ведёт визуал QQbet и Radiance',
		monthlySalary: 180000,
		outsourceHourlyRate: 0,
		payCurrency: 'RUB'
	},
	{
		employeeId: 'artem',
		employeeName: 'Артём Белов',
		employeeRole: 'Дизайнер',
		avatarUrl: 'https://i.pravatar.cc/80?img=15',
		employmentKind: 'staff',
		isBoss: false,
		employeeStatus: 'active',
		hasAcceptedInvite: true,
		employeeEmail: 'artem@studio.com',
		employeeNote: 'Интерфейсы и продуктовые экраны',
		monthlySalary: 165000,
		outsourceHourlyRate: 0,
		payCurrency: 'RUB'
	},
	{
		employeeId: 'mark',
		employeeName: 'Марк Гущин',
		employeeRole: 'Моушен-дизайнер',
		avatarUrl: 'https://i.pravatar.cc/80?img=33',
		employmentKind: 'staff',
		isBoss: false,
		employeeStatus: 'active',
		hasAcceptedInvite: true,
		employeeEmail: 'mark@studio.com',
		employeeNote: 'Моушен, рендеры занимают много времени',
		monthlySalary: 150000,
		outsourceHourlyRate: 0,
		payCurrency: 'RUB'
	},
	{
		employeeId: 'nastya',
		employeeName: 'Настя Реброва',
		employeeRole: 'Проект-менеджер',
		avatarUrl: 'https://i.pravatar.cc/80?img=26',
		employmentKind: 'staff',
		isBoss: false,
		employeeStatus: 'active',
		hasAcceptedInvite: true,
		employeeEmail: 'nastya@studio.com',
		employeeNote: 'Ведёт клиентов и оценки',
		monthlySalary: 140000,
		outsourceHourlyRate: 0,
		payCurrency: 'RUB'
	},
	{
		employeeId: 'ilya-outsource',
		employeeName: 'Илья Сотников',
		employeeRole: 'Иллюстратор (аутсорс)',
		avatarUrl: 'https://i.pravatar.cc/80?img=53',
		employmentKind: 'outsource',
		isBoss: false,
		employeeStatus: 'active',
		hasAcceptedInvite: true,
		employeeEmail: 'ilya@freelance.dev',
		employeeNote: 'Аутсорс-иллюстратор, платим по часам',
		monthlySalary: 0,
		outsourceHourlyRate: 1800,
		payCurrency: 'RUB'
	}
];

export const clients: Client[] = [
	{ clientId: 'qq-holding', clientName: 'QQ Holding', hourlyRate: 2500, currency: 'RUB' },
	{ clientId: 'radiance', clientName: 'Radiance Media', hourlyRate: 35, currency: 'USD' },
	{ clientId: 'otoswap', clientName: 'Otoswap Labs', hourlyRate: 40, currency: 'EUR' },
	{ clientId: 'lead-junkies-client', clientName: 'Lead Junkies', hourlyRate: 2000, currency: 'RUB' }
];

// Messy on purpose: three people invented three names for the same QQbet work,
// and Otoswap arrived twice. The boss merges them later.
export const studioProjects: StudioProject[] = [
	{ projectId: 'qqbet', projectName: 'QQbet', projectColor: '#28D059', clientId: 'qq-holding', mergedIntoProjectId: null },
	{ projectId: 'qq-bet-space', projectName: 'QQ bet', projectColor: '#43C463', clientId: null, mergedIntoProjectId: null },
	{ projectId: 'kkbet-ru', projectName: 'ККбет', projectColor: '#7BD08A', clientId: null, mergedIntoProjectId: null },
	{ projectId: 'radiance', projectName: 'Radiance', projectColor: '#F5A338', clientId: 'radiance', mergedIntoProjectId: null },
	{ projectId: 'otoswap', projectName: 'Otoswap', projectColor: '#3C65E7', clientId: 'otoswap', mergedIntoProjectId: null },
	{ projectId: 'oto-swap-app', projectName: 'Oto Swap App', projectColor: '#5B7BEF', clientId: null, mergedIntoProjectId: null },
	{ projectId: 'lead-junkies', projectName: 'Lead Junkies', projectColor: '#DC3FB2', clientId: 'lead-junkies-client', mergedIntoProjectId: null },
	{ projectId: 'studio-internal', projectName: 'Студия', projectColor: '#8A38F5', clientId: null, mergedIntoProjectId: null }
];

// [taskId, employeeId, projectId, title, description]
const taskSeeds: [string, string, string, string, string][] = [
	['t-logo', 'dasha', 'qqbet', 'Создание логотипа для нового продукта', 'Три направления, выбрали второе'],
	['t-ui', 'dasha', 'qqbet', 'Разработка пользовательского интерфейса', ''],
	['t-spin', 'dasha', 'qq-bet-space', 'Ассеты для спина', 'Отдал в анимацию'],
	['t-jackpot', 'artem', 'qq-bet-space', 'Экран джекпота', ''],
	['t-tables', 'artem', 'kkbet-ru', 'Таблицы и статистика', ''],
	['t-popup', 'artem', 'qqbet', 'Попап выигрыша', ''],
	['t-motion-spin', 'mark', 'kkbet-ru', 'Анимация барабанов', 'Рендер занял полдня'],
	['t-motion-promo', 'mark', 'qqbet', 'Промо-ролик', ''],
	['t-brand', 'dasha', 'radiance', 'Брендбук', ''],
	['t-social', 'mark', 'radiance', 'Соцсети: шаблоны постов', ''],
	['t-otoswap-app', 'artem', 'otoswap', 'Экраны обмена', ''],
	['t-otoswap-web', 'dasha', 'oto-swap-app', 'Лендинг Otoswap', ''],
	['t-leads-ui', 'artem', 'lead-junkies', 'Личный кабинет', ''],
	['t-illustrations', 'ilya-outsource', 'radiance', 'Серия иллюстраций', 'Аутсорс, 12 штук'],
	['t-illustrations-qq', 'ilya-outsource', 'qqbet', 'Иллюстрации персонажей', 'Аутсорс'],
	['t-pm-calls', 'nastya', 'studio-internal', 'Созвоны с клиентами', ''],
	['t-pm-estimates', 'nastya', 'lead-junkies', 'Оценка задач', ''],
	['t-boss-review', 'david', 'studio-internal', 'Ревью макетов', ''],
	['t-boss-invoices', 'david', 'studio-internal', 'Счета и отчёты', ''],
	['t-boss-qq', 'david', 'qqbet', 'Созвон с QQ Holding', '']
];

export const studioTasks: StudioTask[] = taskSeeds.map(
	([taskId, employeeId, projectId, taskTitle, taskDescription]) => ({
		taskId,
		employeeId,
		projectId,
		taskTitle,
		taskDescription
	})
);

// Deterministic pseudo-random so the fake month never jumps between reloads.
function seededValue(seed: string): number {
	let hash = 0;
	for (let index = 0; index < seed.length; index += 1) {
		hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
	}
	return hash / 100000;
}

// Hours for the whole studio, keyed the same way as the personal grid.
export function buildStudioHours(): Record<string, string> {
	const today = new Date();
	const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
	const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
	const hours: Record<string, string> = {};

	for (const task of studioTasks) {
		for (let dayIndex = 0; dayIndex < lastDayOfMonth; dayIndex += 1) {
			const date = addDays(firstDay, dayIndex);
			if (isWeekend(date)) continue;
			const roll = seededValue(`${task.taskId}-${dayIndex}`);
			if (roll < 0.55) continue;
			const quarters = 2 + Math.floor(roll * 12);
			hours[`${task.taskId}:${toIsoDate(date)}`] = String(quarters * 0.5).replace('.', ',');
		}
	}
	return hours;
}

export const vacationRequests: VacationRequest[] = (() => {
	const today = new Date();
	const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
	return [
		{
			vacationId: 'v-dasha',
			employeeId: 'dasha',
			fromDate: toIsoDate(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 12)),
			toDate: toIsoDate(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 20)),
			status: 'pending'
		},
		{
			vacationId: 'v-mark',
			employeeId: 'mark',
			fromDate: toIsoDate(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 3)),
			toDate: toIsoDate(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 7)),
			status: 'approved'
		},
		{
			vacationId: 'v-artem',
			employeeId: 'artem',
			fromDate: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 24)),
			toDate: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 28)),
			status: 'pending'
		},
		// Inside the current week, so vacation cells are visible on first open.
		{
			vacationId: 'v-nastya',
			employeeId: 'nastya',
			fromDate: toIsoDate(addDays(today, -1)),
			toDate: toIsoDate(addDays(today, 2)),
			status: 'approved'
		},
		{
			vacationId: 'v-ilya',
			employeeId: 'ilya-outsource',
			fromDate: toIsoDate(addDays(today, 3)),
			toDate: toIsoDate(addDays(today, 5)),
			status: 'pending'
		}
	];
})();

export function employeeById(employeeId: string): Employee | undefined {
	return employees.find((employee) => employee.employeeId === employeeId);
}

export function clientById(clientId: string | null): Client | undefined {
	return clients.find((client) => client.clientId === clientId);
}

// A merged project always answers with the project it was merged into.
export function resolveProject(projectId: string, projects: StudioProject[]): StudioProject {
	let project = projects.find((candidate) => candidate.projectId === projectId);
	let guard = 0;
	while (project?.mergedIntoProjectId && guard < 10) {
		const next = projects.find((candidate) => candidate.projectId === project?.mergedIntoProjectId);
		if (!next) break;
		project = next;
		guard += 1;
	}
	return project ?? projects[0];
}

// The grid speaks ProjectWithTasks, so the studio data is folded into that shape.
export function groupTasksIntoProjects(
	tasks: StudioTask[],
	projects: StudioProject[]
): ProjectWithTasks[] {
	const grouped: ProjectWithTasks[] = [];
	for (const task of tasks) {
		const project = resolveProject(task.projectId, projects);
		let bucket = grouped.find((candidate) => candidate.projectId === project.projectId);
		if (!bucket) {
			bucket = {
				projectId: project.projectId,
				projectName: project.projectName,
				projectColor: project.projectColor,
				tasks: []
			};
			grouped.push(bucket);
		}
		bucket.tasks.push(task);
	}
	return grouped;
}
