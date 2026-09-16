<!--
	`/boss` — the studio lead's app in four tabs: Студия (everyone's tasks, with
	filters and configurable grouping), Мои задачи (his own week), Команда (people
	× days, vacations, hiring, employee cards), Проекты и клиенты (editing,
	merging, rates, client report links).
	Prototype: fake studio data, no auth, no admin guard.
-->
<script lang="ts">
	import WeekGrid from '$lib/components/WeekGrid.svelte';
	import PeriodToolbar from '$lib/components/PeriodToolbar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TeamGrid from '$lib/components/TeamGrid.svelte';
	import GridToolbar from '$lib/components/GridToolbar.svelte';
	import ViewModeMenu from '$lib/components/ViewModeMenu.svelte';
	import SettingsModal, { type SettingsTab } from '$lib/components/SettingsModal.svelte';
	import ExcelModal, { type ExcelMode } from '$lib/components/ExcelModal.svelte';
	import { type ProjectWithTasks } from '$lib/fakeData';
	import { type ViewMode } from '$lib/dates';
	import { notifyEmployees } from '$lib/notifications.svelte';
	import { studioProfile } from '$lib/studioProfile.svelte';
	import {
		allVacations,
		pendingVacations,
		vacationDatesOf,
		decideVacation
	} from '$lib/vacations.svelte';
	import {
		formatHours,
		parseHours,
		aggregateHours,
		buildHoursByTaskId,
		expectedHoursFor,
		splitCellKey
	} from '$lib/hours';
	import { toIsoDate, projectColorPalette } from '$lib/fakeData';
	import {
		employees as initialEmployees,
		clients as initialClients,
		currencySymbols,
		studioProjects,
		studioTasks,
		buildStudioHours,
		groupTasksIntoProjects,
		employeeById,
		clientById,
		resolveProject,
		type StudioProject,
		type StudioTask,
		type Client,
		type Employee,
		type EmploymentKind,
		type Currency
	} from '$lib/studioData';

	// Prototype only — studio-wide fake data, no database yet.

	const bossEmployeeId = 'david';
	const boss = employeeById(bossEmployeeId);

	type BossTab = 'studio' | 'mine' | 'projects' | 'team';
	let activeTab = $state<BossTab>('studio');

	let projectList = $state<StudioProject[]>(studioProjects.map((project) => ({ ...project })));
	let taskList = $state<StudioTask[]>(studioTasks.map((task) => ({ ...task })));
	let hoursByTaskAndDate = $state<Record<string, string>>(buildStudioHours());
	let clientList = $state<Client[]>(initialClients.map((client) => ({ ...client })));
	let employeeList = $state<Employee[]>(initialEmployees.map((employee) => ({ ...employee })));
	let showArchivedEmployees = $state(false);

	const employees = $derived(
		employeeList.filter(
			(employee) => showArchivedEmployees || employee.employeeStatus !== 'archived'
		)
	);

	function employeeOf(employeeId: string): Employee | undefined {
		return employeeList.find((employee) => employee.employeeId === employeeId);
	}

	// --- Hiring, inviting, archiving ---
	let isAddPersonOpen = $state(false);
	let newPersonKind = $state<EmploymentKind>('staff');
	let newPersonName = $state('');
	let newPersonEmail = $state('');
	let newPersonRole = $state('');
	let newPersonSalary = $state(150000);
	let newPersonRate = $state(1800);

	function openAddPerson(kind: EmploymentKind) {
		newPersonKind = kind;
		newPersonName = '';
		newPersonEmail = '';
		newPersonRole = kind === 'outsource' ? 'Аутсорс-специалист' : 'Дизайнер';
		isAddPersonOpen = true;
	}

	// Staff get an invite to the email; outsource people are just a row the boss keeps.
	function confirmAddPerson() {
		const employeeName = newPersonName.trim();
		if (!employeeName) return;
		const employeeId = `employee-${Date.now()}`;
		employeeList = [
			...employeeList,
			{
				employeeId,
				employeeName,
				employeeRole: newPersonRole.trim() || 'Без роли',
				avatarUrl: `https://i.pravatar.cc/80?u=${employeeId}`,
				employmentKind: newPersonKind,
				isBoss: false,
				employeeStatus: newPersonKind === 'staff' ? 'invited' : 'active',
				// Staff have to accept the invite; outsource people have no account at all.
				hasAcceptedInvite: newPersonKind !== 'staff',
				employeeEmail: newPersonEmail.trim(),
				employeeNote: '',
				monthlySalary: newPersonKind === 'staff' ? newPersonSalary : 0,
				outsourceHourlyRate: newPersonKind === 'outsource' ? newPersonRate : 0,
				payCurrency: 'RUB'
			}
		];
		if (newPersonKind === 'staff' && newPersonEmail.trim()) {
			notifyEmployees(
				[bossEmployeeId],
				`Приглашение отправлено на ${newPersonEmail.trim()} — ждём, когда примут.`
			);
		}
		isAddPersonOpen = false;
	}

	let editingEmployeeId = $state<string | null>(null);
	const editingEmployee = $derived(
		editingEmployeeId ? employeeOf(editingEmployeeId) : undefined
	);

	function updateEmployee(employeeId: string, changes: Partial<Employee>) {
		employeeList = employeeList.map((employee) =>
			employee.employeeId === employeeId ? { ...employee, ...changes } : employee
		);
	}

	function archiveEmployee(employeeId: string) {
		updateEmployee(employeeId, { employeeStatus: 'archived' });
		editingEmployeeId = null;
	}

	// Staff who never accepted the invite go back to "invited", not "active".
	function restoreEmployee(employeeId: string) {
		const employee = employeeOf(employeeId);
		const wasNeverActivated = employee?.employmentKind === 'staff' && !employee.hasAcceptedInvite;
		updateEmployee(employeeId, { employeeStatus: wasNeverActivated ? 'invited' : 'active' });
	}

	function resendInvite(employeeId: string) {
		const employee = employeeOf(employeeId);
		if (!employee) return;
		updateEmployee(employeeId, { employeeStatus: 'invited' });
		notifyEmployees([bossEmployeeId], `Приглашение отправлено заново: ${employee.employeeEmail}.`);
	}
	// Vacations live in one shared store, so approving here changes every screen.
	const vacationList = $derived(allVacations());
	const pendingVacationCount = $derived(pendingVacations().length);
	const bossVacationDates = $derived(vacationDatesOf(bossEmployeeId));

	let selectedDate = $state(new Date());
	let viewMode = $state<ViewMode>('week');
	let slideDirection = $state(1);
	let isSidebarOpen = $state(true);
	let isTeamViewMenuOpen = $state(false);
	let weekGrid = $state<ReturnType<typeof WeekGrid> | null>(null);
	let gridToolbar = $state<ReturnType<typeof GridToolbar> | null>(null);

	let isSettingsOpen = $state(false);
	let settingsTab = $state<SettingsTab>('appearance');
	let targetHoursPerDayPerPerson = $state(8);
	let minimumHoursPerDay = $state(6);
	let workDaysPerWeek = $state(5);
	let workDayStartHour = $state(9);
	let workDayEndHour = $state(17);
	let roundToQuarterHour = $state(true);
	let showWeekendsSetting = $state(true);
	let accentPreference = $state('system');
	let appearanceFont = $state('Inter');
	let appearanceBaseFontSize = $state(16);
	let appearanceRowPadding = $state(8);
	let interfaceLanguage = $state('ru');
	const interfaceLanguages = [
		{ code: 'ru', label: 'Русский' },
		{ code: 'en', label: 'English' }
	];
	const workspaces = $derived([
		{ workspaceId: 'studio', workspaceName: studioProfile.studioName, workspaceColor: '#28D059' }
	]);
	let currentWorkspaceId = $state('studio');

	function handleGlobalKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			openNewTaskModal();
		}
		if (event.key === 'Escape') {
			isNewTaskModalOpen = false;
			isSettingsOpen = false;
			isShareModalOpen = false;
			isExcelModalOpen = false;
			mergingProjectId = null;
			reassigningTaskId = null;
		}
	}

	function openSettingsAt(tab: SettingsTab) {
		settingsTab = tab;
		isSettingsOpen = true;
	}

	const showWeekends = $derived(showWeekendsSetting);

	const staffCount = $derived(
		employees.filter((employee) => employee.employmentKind === 'staff').length
	);

	// Studio-wide views expect the whole team's hours, not one person's.
	const headcountForTab = $derived(activeTab === 'mine' ? 1 : staffCount);
	const targetHoursPerDay = $derived(targetHoursPerDayPerPerson * headcountForTab);

	// Empty filter list means "everything" — no need to preselect anyone.
	let filterEmployeeIds = $state<string[]>([]);
	let filterClientIds = $state<string[]>([]);
	let filterProjectIds = $state<string[]>([]);
	let filterQuery = $state('');
	let openFilterMenu = $state<'employee' | 'client' | 'project' | null>(null);

	const activeFilterCount = $derived(
		filterEmployeeIds.length +
			filterClientIds.length +
			filterProjectIds.length +
			(filterQuery.trim() ? 1 : 0)
	);

	function toggleFilter(currentIds: string[], id: string): string[] {
		return currentIds.includes(id) ? currentIds.filter((item) => item !== id) : [...currentIds, id];
	}

	function clearFilters() {
		filterEmployeeIds = [];
		filterClientIds = [];
		filterProjectIds = [];
		filterQuery = '';
	}

	function clientIdOfTask(task: StudioTask): string | null {
		return resolveProject(task.projectId, projectList).clientId;
	}

	const tasksOfActiveTab = $derived(
		activeTab === 'mine'
			? taskList.filter((task) => task.employeeId === bossEmployeeId)
			: taskList
	);

	const tasksInActiveTab = $derived.by(() => {
		if (activeTab === 'mine') return tasksOfActiveTab;
		const query = filterQuery.trim().toLowerCase();
		return tasksOfActiveTab.filter((task) => {
			if (filterEmployeeIds.length > 0 && !filterEmployeeIds.includes(task.employeeId)) return false;
			if (filterProjectIds.length > 0 && !filterProjectIds.includes(task.projectId)) return false;
			if (filterClientIds.length > 0) {
				const clientId = clientIdOfTask(task);
				if (!clientId || !filterClientIds.includes(clientId)) return false;
			}
			if (query && !task.taskTitle.toLowerCase().includes(query)) return false;
			return true;
		});
	});

	// WeekGrid owns its rows, so the grouped shape is rebuilt whenever the tab changes.
	function buildGroups(
		tasks: StudioTask[]
	): (ProjectWithTasks & { groupAvatarUrl?: string })[] {
		const groups: (ProjectWithTasks & { groupAvatarUrl?: string })[] = [];
		for (const task of tasks) {
			const dimension = dimensionOf(task, groupBy);
			let bucket = groups.find((candidate) => candidate.projectId === dimension.keyId);
			if (!bucket) {
				bucket = {
					projectId: dimension.keyId,
					projectName: dimension.keyLabel,
					projectColor: dimension.keyColor,
					groupAvatarUrl: dimension.avatarUrl,
					tasks: []
				};
				groups.push(bucket);
			}
			bucket.tasks.push(task);
		}
		if (groupBy === 'project') {
			for (const project of liveProjects) {
				if (groups.some((group) => group.projectId === project.projectId)) continue;
				groups.push({
					projectId: project.projectId,
					projectName: project.projectName,
					projectColor: project.projectColor,
					tasks: []
				});
			}
		}

		if (groupSort === 'hours') {
			groups.sort(
				(first, second) =>
					second.tasks.reduce((sum, task) => sum + (hoursByTaskId[task.taskId] ?? 0), 0) -
					first.tasks.reduce((sum, task) => sum + (hoursByTaskId[task.taskId] ?? 0), 0)
			);
		} else {
			groups.sort((first, second) => first.projectName.localeCompare(second.projectName));
		}
		return groups;
	}

	let gridProjects = $state<(ProjectWithTasks & { groupAvatarUrl?: string })[]>(
		groupTasksIntoProjects(studioTasks, studioProjects)
	);
	$effect(() => {
		gridProjects = buildGroups(tasksInActiveTab);
	});

	// --- Projects and clients admin ---
	const liveProjects = $derived(projectList.filter((project) => !project.mergedIntoProjectId));

	function tasksOfProject(projectId: string): StudioTask[] {
		return taskList.filter((task) => task.projectId === projectId);
	}

	function hoursOfProject(projectId: string): number {
		return tasksOfProject(projectId).reduce(
			(sum, task) => sum + (hoursByTaskId[task.taskId] ?? 0),
			0
		);
	}

	function hoursOfClient(clientId: string): number {
		return projectList
			.filter((project) => resolveProject(project.projectId, projectList).clientId === clientId)
			.reduce((sum, project) => sum + hoursOfProject(project.projectId), 0);
	}

	function employeesOfProject(projectId: string) {
		const ids = new Set(tasksOfProject(projectId).map((task) => task.employeeId));
		return [...ids].map((employeeId) => employeeOf(employeeId)).filter(Boolean);
	}

	let mergingProjectId = $state<string | null>(null);

	// Merging is async work: everyone's rows follow, and everyone gets told.
	function mergeProjectInto(targetProjectId: string) {
		const sourceProject = projectList.find((project) => project.projectId === mergingProjectId);
		const targetProject = projectList.find((project) => project.projectId === targetProjectId);
		if (!sourceProject || !targetProject || sourceProject === targetProject) return;

		const affectedEmployeeIds = employeesOfProject(sourceProject.projectId).map(
			(employee) => employee!.employeeId
		);

		projectList = projectList.map((project) =>
			project.projectId === sourceProject.projectId
				? { ...project, mergedIntoProjectId: targetProject.projectId }
				: project
		);
		taskList = taskList.map((task) =>
			task.projectId === sourceProject.projectId
				? { ...task, projectId: targetProject.projectId }
				: task
		);

		notifyEmployees(
			affectedEmployeeIds,
			`Проект «${sourceProject.projectName}» объединён с «${targetProject.projectName}» — ваши задачи перенесены.`
		);
		mergingProjectId = null;
	}

	function addProjectFromTable(projectName: string): string {
		const projectId = `project-${Date.now()}`;
		projectList = [
			...projectList,
			{
				projectId,
				projectName,
				projectColor: projectColorPalette[projectList.length % projectColorPalette.length],
				clientId: null,
				mergedIntoProjectId: null
			}
		];
		return projectId;
	}



	// --- Client and project editors ---
	let editingClientId = $state<string | null>(null);
	let clientDraft = $state<Client>({
		clientId: '',
		clientName: '',
		hourlyRate: 2000,
		currency: 'RUB'
	});

	function openClientEditor(client: Client | null) {
		clientDraft = client
			? { ...client }
			: { clientId: '', clientName: '', hourlyRate: 2000, currency: 'RUB' };
		editingClientId = client ? client.clientId : 'new';
	}

	function saveClientEditor() {
		const clientName = clientDraft.clientName.trim();
		if (!clientName) return;
		if (editingClientId === 'new') {
			clientList = [...clientList, { ...clientDraft, clientId: `client-${Date.now()}`, clientName }];
		} else {
			updateClient(clientDraft.clientId, { ...clientDraft, clientName });
		}
		editingClientId = null;
	}

	function deleteClient(clientId: string) {
		clientList = clientList.filter((client) => client.clientId !== clientId);
		projectList = projectList.map((project) =>
			project.clientId === clientId ? { ...project, clientId: null } : project
		);
		editingClientId = null;
	}

	let editingProjectId = $state<string | null>(null);
	let projectDraft = $state<StudioProject>({
		projectId: '',
		projectName: '',
		projectColor: projectColorPalette[0],
		clientId: null,
		mergedIntoProjectId: null
	});

	function openProjectEditor(project: StudioProject | null) {
		projectDraft = project
			? { ...project }
			: {
					projectId: '',
					projectName: '',
					projectColor: projectColorPalette[projectList.length % projectColorPalette.length],
					clientId: null,
					mergedIntoProjectId: null
				};
		editingProjectId = project ? project.projectId : 'new';
	}

	function saveProjectEditor() {
		const projectName = projectDraft.projectName.trim();
		if (!projectName) return;
		if (editingProjectId === 'new') {
			projectList = [
				...projectList,
				{ ...projectDraft, projectId: `project-${Date.now()}`, projectName }
			];
		} else {
			projectList = projectList.map((project) =>
				project.projectId === projectDraft.projectId
					? { ...project, ...projectDraft, projectName }
					: project
			);
		}
		editingProjectId = null;
	}

	function deleteProject(projectId: string) {
		if (tasksOfProject(projectId).length > 0) return;
		projectList = projectList.filter((project) => project.projectId !== projectId);
		editingProjectId = null;
	}

	function updateClient(clientId: string, changes: Partial<Client>) {
		clientList = clientList.map((client) =>
			client.clientId === clientId ? { ...client, ...changes } : client
		);
	}

	// --- Excel import/export: layout only, nothing is read or written yet ---
	let isExcelModalOpen = $state(false);
	let excelMode = $state<ExcelMode>('export');

	function openExcelModal(mode: ExcelMode) {
		excelMode = mode;
		isExcelModalOpen = true;
	}

	// --- Public link for a client report ---
	let isShareModalOpen = $state(false);
	let shareClientIds = $state<string[]>([]);
	let shareProjectIds = $state<string[]>([]);
	let shareEmployeeIds = $state<string[]>([]);
	let shareFromDate = $state('');
	let shareToDate = $state('');
	let openShareMenu = $state<'clients' | 'projects' | 'employees' | null>(null);
	let shareIncludeRate = $state(true);
	let shareShowPeople = $state(true);
	let shareShowDescriptions = $state(true);
	let isShareLinkCopied = $state(false);

	// The link starts from whatever period is on screen; the modal can widen it.
	function openShareModal(clientId?: string) {
		const periodDates = visibleDatesFor(selectedDate, viewMode, true);
		shareFromDate = toIsoDate(periodDates[0] ?? selectedDate);
		shareToDate = toIsoDate(periodDates[periodDates.length - 1] ?? selectedDate);
		shareClientIds = clientId ? [clientId] : filterClientIds.length > 0 ? [...filterClientIds] : [];
		shareProjectIds = filterProjectIds.length > 0 ? [...filterProjectIds] : [];
		shareEmployeeIds = filterEmployeeIds.length > 0 ? [...filterEmployeeIds] : [];
		isShareLinkCopied = false;
		isShareModalOpen = true;
	}

	// Year view has no day list, so the whole year is the period.
	$effect(() => {
		if (!isShareModalOpen || viewMode !== 'year') return;
		shareFromDate = toIsoDate(new Date(selectedDate.getFullYear(), 0, 1));
		shareToDate = toIsoDate(new Date(selectedDate.getFullYear(), 11, 31));
	});

	const shareRateClient = $derived(
		shareClientIds.length === 1
			? clientList.find((client) => client.clientId === shareClientIds[0])
			: undefined
	);

	const shareLinkPath = $derived.by(() => {
		const params = new URLSearchParams({ scope: 'studio', from: shareFromDate, to: shareToDate });
		if (shareClientIds.length === 1) params.set('client', shareClientIds[0]);
		else if (shareClientIds.length > 1) params.set('clients', shareClientIds.join(','));
		if (shareProjectIds.length > 0) params.set('projects', shareProjectIds.join(','));
		if (shareEmployeeIds.length > 0) params.set('employees', shareEmployeeIds.join(','));
		if (!shareIncludeRate) params.set('rate', '0');
		if (shareShowPeople) params.set('people', '1');
		if (shareShowDescriptions) params.set('details', '1');
		return `/share?${params.toString()}`;
	});

	const shareLink = $derived(
		(typeof window === 'undefined' ? '' : window.location.origin) + shareLinkPath
	);

	async function copyShareLink() {
		await navigator.clipboard.writeText(shareLink);
		isShareLinkCopied = true;
	}

	// --- Reports ---
	import { visibleDatesFor } from '$lib/dates';

	const reportDates = $derived(visibleDatesFor(selectedDate, viewMode, true));

	// Hours per employee inside the report period, in one pass.
	const periodHoursByEmployee = $derived.by(() => {
		const isoDates = new Set(reportDates.map((date) => toIsoDate(date)));
		return aggregateHours(hoursByTaskAndDate, (taskId, isoDate) =>
			isoDates.has(isoDate) ? (taskById[taskId]?.employeeId ?? null) : null
		);
	});

	function hoursOfEmployeeInPeriod(employeeId: string): number {
		return periodHoursByEmployee[employeeId] ?? 0;
	}

	const studioHoursInPeriod = $derived(
		Object.values(periodHoursByEmployee).reduce((sum, hours) => sum + hours, 0)
	);

	const expectedStudioHours = $derived(
		expectedHoursFor(reportDates, targetHoursPerDayPerPerson, staffCount)
	);

	const outsourcedHours = $derived(
		employees
			.filter((employee) => employee.employmentKind === 'outsource')
			.reduce((sum, employee) => sum + hoursOfEmployeeInPeriod(employee.employeeId), 0)
	);

	function shareLinkForClient(clientId: string): string {
		const params = new URLSearchParams({
			scope: 'studio',
			client: clientId,
			from: toIsoDate(reportDates[0] ?? selectedDate),
			to: toIsoDate(reportDates[reportDates.length - 1] ?? selectedDate),
			details: '1',
			people: '1'
		});
		return `/share?${params.toString()}`;
	}

	// --- Creating and reassigning tasks on behalf of anyone ---
	let isNewTaskModalOpen = $state(false);
	let newTaskTitle = $state('');
	let newTaskEmployeeId = $state(bossEmployeeId);
	let newTaskProjectId = $state(studioProjects[0].projectId);

	function openNewTaskModal() {
		newTaskTitle = '';
		newTaskEmployeeId = activeTab === 'mine' ? bossEmployeeId : (filterEmployeeIds[0] ?? bossEmployeeId);
		newTaskProjectId = filterProjectIds[0] ?? projectList[0].projectId;
		isNewTaskModalOpen = true;
	}

	// The modal can create the project it needs, so a first task never blocks.
	const newProjectOptionId = '__new-project__';
	let newTaskNewProjectName = $state('');

	function confirmNewTask() {
		const trimmedTitle = newTaskTitle.trim();
		if (!trimmedTitle) return;
		if (newTaskProjectId === newProjectOptionId) {
			const projectName = newTaskNewProjectName.trim();
			if (!projectName) return;
			const projectId = `project-${Date.now()}`;
			projectList = [
				...projectList,
				{
					projectId,
					projectName,
					projectColor:
						projectColorPalette[projectList.length % projectColorPalette.length],
					clientId: null,
					mergedIntoProjectId: null
				}
			];
			newTaskProjectId = projectId;
			newTaskNewProjectName = '';
		}
		taskList = [
			...taskList,
			{
				taskId: `t-${Date.now()}`,
				taskTitle: trimmedTitle,
				taskDescription: '',
				employeeId: newTaskEmployeeId,
				projectId: newTaskProjectId
			}
		];
		isNewTaskModalOpen = false;
	}

	let reassigningTaskId = $state<string | null>(null);

	function reassignTaskTo(employeeId: string) {
		taskList = taskList.map((task) =>
			task.taskId === reassigningTaskId ? { ...task, employeeId } : task
		);
		reassigningTaskId = null;
	}

	// --- Grouping, and the label each row carries ---
	type GroupDimension = 'project' | 'employee' | 'client';
	type BadgeDimension = GroupDimension | 'none';

	// Each tab keeps its own grouping — the studio view and his own rows are
	// different questions.
	let studioGrouping = $state<{ groupBy: GroupDimension; rowBadge: BadgeDimension }>({
		groupBy: 'project',
		rowBadge: 'employee'
	});
	// Мои задачи is the same screen as the personal route: grouped by project,
	// no row labels, nothing to configure.
	const myGrouping = { groupBy: 'project' as GroupDimension, rowBadge: 'none' as BadgeDimension };

	const grouping = $derived(activeTab === 'mine' ? myGrouping : studioGrouping);
	const groupBy = $derived(grouping.groupBy);
	const rowBadge = $derived(grouping.rowBadge);

	// Only the studio tab is configurable, and grouping and the row label must
	// describe different things.
	function setGroupBy(dimension: GroupDimension) {
		studioGrouping.groupBy = dimension;
		if (studioGrouping.rowBadge === dimension) {
			studioGrouping.rowBadge = dimension === 'employee' ? 'project' : 'employee';
		}
	}

	function setRowBadge(dimension: BadgeDimension) {
		studioGrouping.rowBadge = dimension;
	}
	let groupSort = $state<'name' | 'hours'>('name');
	let openGroupMenu = $state<'group' | 'badge' | 'sort' | null>(null);

	const groupLabels: Record<GroupDimension, string> = {
		project: 'Проект',
		employee: 'Сотрудник',
		client: 'Клиент'
	};

	const badgeLabels: Record<BadgeDimension, string> = { ...groupLabels, none: 'Без подписи' };

	const employeeColorById = $derived.by(() => {
		const palette = ['#8A38F5', '#F5A338', '#3C65E7', '#DC3FB2', '#28D059', '#6b6b6b'];
		const colors: Record<string, string> = {};
		employeeList.forEach((employee, index) => {
			colors[employee.employeeId] = palette[index % palette.length];
		});
		return colors;
	});

	const taskById = $derived.by(() => {
		const map: Record<string, StudioTask> = {};
		for (const task of taskList) map[task.taskId] = task;
		return map;
	});

	function dimensionOf(task: StudioTask, dimension: GroupDimension) {
		if (dimension === 'employee') {
			const employee = employeeOf(task.employeeId);
			return {
				keyId: task.employeeId,
				keyLabel: employee?.employeeName ?? 'Без сотрудника',
				keyColor: employeeColorById[task.employeeId] ?? '#6b6b6b',
				avatarUrl: employee?.avatarUrl
			};
		}
		if (dimension === 'client') {
			const clientId = clientIdOfTask(task);
			const client = clientId ? clientList.find((candidate) => candidate.clientId === clientId) : undefined;
			return {
				keyId: clientId ?? 'no-client',
				keyLabel: client?.clientName ?? 'Без клиента',
				keyColor: client ? '#3C65E7' : '#6b6b6b',
				avatarUrl: undefined
			};
		}
		const project = resolveProject(task.projectId, projectList);
		return {
			keyId: project.projectId,
			keyLabel: project.projectName,
			keyColor: project.projectColor,
			avatarUrl: undefined
		};
	}

	function taskBadgeOf(taskId: string) {
		if (rowBadge === 'none') return null;
		const task = taskById[taskId];
		if (!task) return null;
		const dimension = dimensionOf(task, rowBadge);
		return {
			badgeLabel: dimension.keyLabel,
			avatarUrl: dimension.avatarUrl,
			badgeColor: dimension.avatarUrl ? undefined : dimension.keyColor
		};
	}

	const hoursByTaskId = $derived(buildHoursByTaskId(hoursByTaskAndDate));

	// The sidebar is the boss's own week, never the studio's — same as on `/`.
	const bossOwnHours = $derived.by(() => {
		const own: Record<string, string> = {};
		for (const [cellKey, value] of Object.entries(hoursByTaskAndDate)) {
			const { taskId } = splitCellKey(cellKey);
			if (taskById[taskId]?.employeeId === bossEmployeeId) own[cellKey] = value;
		}
		return own;
	});
</script>

<svelte:head>
	<title>Студия — Tweekm</title>
</svelte:head>

{#snippet sharePicker(
	menuId: 'clients' | 'projects' | 'employees',
	menuLabel: string,
	selectedIds: string[],
	options: { optionId: string; optionLabel: string }[]
)}
	<div class="dropdown">
		<button
			class="pill-button filter-button"
			class:is-active={selectedIds.length > 0}
			onclick={(event) => {
				event.stopPropagation();
				openShareMenu = openShareMenu === menuId ? null : menuId;
			}}
		>
			{menuLabel}{selectedIds.length > 0 ? ` · ${selectedIds.length}` : ': все'} ▾
		</button>

		{#if openShareMenu === menuId}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div class="dropdown-panel is-list" onclick={(event) => event.stopPropagation()}>
				{#each options as option (option.optionId)}
					<button
						class="filter-option"
						class:is-checked={selectedIds.includes(option.optionId)}
						onclick={() => {
							if (menuId === 'clients') shareClientIds = toggleFilter(shareClientIds, option.optionId);
							else if (menuId === 'projects')
								shareProjectIds = toggleFilter(shareProjectIds, option.optionId);
							else shareEmployeeIds = toggleFilter(shareEmployeeIds, option.optionId);
						}}
					>
						{option.optionLabel}
						{#if selectedIds.includes(option.optionId)}<span class="filter-check">✓</span>{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet groupMenu(
	menuId: 'group' | 'badge' | 'sort',
	menuLabel: string,
	currentLabel: string,
	options: { optionId: string; optionLabel: string }[]
)}
	<div class="dropdown">
		<button
			class="pill-button"
			onclick={(event) => {
				event.stopPropagation();
				openGroupMenu = openGroupMenu === menuId ? null : menuId;
			}}
		>
			{menuLabel}: {currentLabel} ▾
		</button>

		{#if openGroupMenu === menuId}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div class="dropdown-panel is-list" onclick={(event) => event.stopPropagation()}>
				{#each options as option (option.optionId)}
					<button
						onclick={() => {
							if (menuId === 'group') setGroupBy(option.optionId as GroupDimension);
							else if (menuId === 'badge') setRowBadge(option.optionId as BadgeDimension);
							else groupSort = option.optionId as 'name' | 'hours';
							openGroupMenu = null;
						}}
					>
						{option.optionLabel}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

{#snippet filterMenu(
	menuId: 'employee' | 'client' | 'project',
	menuLabel: string,
	selectedIds: string[],
	options: { optionId: string; optionLabel: string; optionColor: string }[]
)}
	<div class="dropdown">
		<button
			class="pill-button filter-button"
			class:is-active={selectedIds.length > 0}
			onclick={(event) => {
				event.stopPropagation();
				openFilterMenu = openFilterMenu === menuId ? null : menuId;
			}}
		>
			{menuLabel}{selectedIds.length > 0 ? ` · ${selectedIds.length}` : ''} ▾
		</button>

		{#if openFilterMenu === menuId}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div class="dropdown-panel is-list" onclick={(event) => event.stopPropagation()}>
				{#each options as option (option.optionId)}
					<button
						class="filter-option"
						class:is-checked={selectedIds.includes(option.optionId)}
						onclick={() => {
							if (menuId === 'employee') filterEmployeeIds = toggleFilter(filterEmployeeIds, option.optionId);
							else if (menuId === 'client') filterClientIds = toggleFilter(filterClientIds, option.optionId);
							else filterProjectIds = toggleFilter(filterProjectIds, option.optionId);
						}}
					>
						<span class="project-dot" style="background: {option.optionColor}"></span>
						{option.optionLabel}
						{#if selectedIds.includes(option.optionId)}<span class="filter-check">✓</span>{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<svelte:window onkeydown={handleGlobalKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
	class="boss-layout"
	class:is-sidebar-collapsed={!isSidebarOpen}
	style="font-family: '{appearanceFont}', ui-sans-serif, system-ui, sans-serif;
	       --row-padding: {appearanceRowPadding / 16}rem"
	onclick={() => {
		gridToolbar?.closeMenus();
		openFilterMenu = null;
		openGroupMenu = null;
		openShareMenu = null;
		isTeamViewMenuOpen = false;
	}}
>
	<main class="boss-main">
		<div class="boss-header">
			<div class="boss-tabs">
				<button class="boss-tab" class:is-active={activeTab === 'studio'} onclick={() => (activeTab = 'studio')}>
					Студия
				</button>
				<button class="boss-tab" class:is-active={activeTab === 'mine'} onclick={() => (activeTab = 'mine')}>
					Мои задачи
				</button>
				<button class="boss-tab" class:is-active={activeTab === 'team'} onclick={() => (activeTab = 'team')}>
					Команда
					{#if pendingVacationCount > 0}
						<span class="tab-badge">{pendingVacationCount}</span>
					{/if}
				</button>
				<button
					class="boss-tab"
					class:is-active={activeTab === 'projects'}
					onclick={() => (activeTab = 'projects')}
				>
					Проекты и клиенты
				</button>
			</div>

		</div>

		{#if activeTab === 'team'}
			<div class="toolbar">
				<div class="toolbar-group">
					<PeriodToolbar bind:selectedDate bind:viewMode bind:slideDirection {showWeekends} />
				</div>
				<div class="toolbar-group toolbar-group-right">
					<span class="boss-count">{employees.length} человек</span>
					<button class="pill-button" onclick={() => openAddPerson('outsource')}>+ Аутсорс</button>
					<button class="pill-button is-dark" onclick={() => openAddPerson('staff')}>
						+ Пригласить
					</button>
					<button
						class="pill-button"
						class:is-dark={showArchivedEmployees}
						onclick={() => (showArchivedEmployees = !showArchivedEmployees)}
					>
						Архив
					</button>
					<ViewModeMenu bind:viewMode bind:isOpen={isTeamViewMenuOpen} />
				</div>
			</div>

			<div class="team-summary">
				<div class="report-cards">
					<div class="report-card">
						<span class="report-card-label">Отработано</span>
						<strong class="report-card-value">{formatHours(studioHoursInPeriod)} ч</strong>
					</div>
					<div class="report-card">
						<span class="report-card-label">Ожидалось</span>
						<strong class="report-card-value">{formatHours(expectedStudioHours)} ч</strong>
					</div>
					<div class="report-card">
						<span class="report-card-label">Загрузка</span>
						<strong class="report-card-value">
							{expectedStudioHours === 0
								? '—'
								: `${Math.round((studioHoursInPeriod / expectedStudioHours) * 100)}%`}
						</strong>
					</div>
					<div class="report-card">
						<span class="report-card-label">Аутсорс</span>
						<strong class="report-card-value">{formatHours(outsourcedHours)} ч</strong>
					</div>
				</div>
			</div>

			<TeamGrid
				{employees}
				tasks={taskList}
				{hoursByTaskAndDate}
				vacations={vacationList}
				{selectedDate}
				{viewMode}
				targetHoursPerDay={targetHoursPerDayPerPerson}
				{showWeekends}
				onApproveVacation={(vacationId) => decideVacation(vacationId, 'approved')}
				onDeclineVacation={(vacationId) => decideVacation(vacationId, 'declined')}
				onOpenEmployee={(employeeId) => (editingEmployeeId = employeeId)}
			/>
		{:else if activeTab === 'projects'}
			<div class="admin-scroll">
				<section class="admin-section">
					<div class="admin-heading">
						<h2 class="admin-title">Клиенты</h2>
						<button class="pill-button" onclick={() => openClientEditor(null)}>+ Клиент</button>
					</div>
					<p class="admin-hint">
						Правьте прямо в строке; «⋯» открывает остальное — часы за период и удаление.
					</p>

					{#if clientList.length === 0}
						<div class="admin-blank">
							<strong>Клиентов пока нет</strong>
							<span>Клиент задаёт ставку и валюту для отчётов — добавьте первого.</span>
							<button class="pill-button is-dark" onclick={() => openClientEditor(null)}>
								+ Клиент
							</button>
						</div>
					{/if}

					{#each clientList as client (client.clientId)}
						<div class="admin-row">
							<input
								class="admin-input is-name"
								value={client.clientName}
								oninput={(event) =>
									updateClient(client.clientId, { clientName: event.currentTarget.value })}
							/>

							<span class="admin-projects">
								{#each liveProjects.filter((project) => project.clientId === client.clientId) as project (project.projectId)}
									<span class="admin-chip">
										<span class="project-dot" style="background: {project.projectColor}"></span>
										{project.projectName}
									</span>
								{:else}
									<span class="admin-empty">Нет проектов</span>
								{/each}
							</span>

							<span class="admin-hours">{formatHours(hoursOfClient(client.clientId))} ч</span>

							<input
								class="admin-input is-rate"
								type="number"
								min="0"
								step="50"
								value={client.hourlyRate}
								oninput={(event) =>
									updateClient(client.clientId, { hourlyRate: Number(event.currentTarget.value) })}
							/>

							<select
								class="admin-input is-currency"
								value={client.currency}
								onchange={(event) =>
									updateClient(client.clientId, {
										currency: event.currentTarget.value as Currency
									})}
							>
								<option value="RUB">₽ RUB</option>
								<option value="USD">$ USD</option>
								<option value="EUR">€ EUR</option>
							</select>

							<span class="admin-total">
								{Math.round(hoursOfClient(client.clientId) * client.hourlyRate).toLocaleString('ru-RU')}
								{currencySymbols[client.currency]}
							</span>

							<button
								class="icon-button-light admin-more"
								title="Все настройки клиента"
								onclick={() => openClientEditor(client)}>⋯</button
							>

							<button class="pill-button is-dark" onclick={() => openShareModal(client.clientId)}>
								Отчёт клиенту
							</button>
						</div>
					{/each}
				</section>

				<section class="admin-section">
					<div class="admin-heading">
						<h2 class="admin-title">Проекты</h2>
						<button class="pill-button" onclick={() => openProjectEditor(null)}>+ Проект</button>
					</div>
					<p class="admin-hint">
						Сотрудники заводят проекты сами — одинаковые можно объединить, задачи переедут, а людям
						придёт уведомление.
					</p>

					{#if projectList.length === 0}
						<div class="admin-blank">
							<strong>Проектов пока нет</strong>
							<span>Сотрудники заводят их сами, когда ставят часы — или создайте вручную.</span>
							<button class="pill-button is-dark" onclick={() => openProjectEditor(null)}>
								+ Проект
							</button>
						</div>
					{/if}

					{#each projectList as project (project.projectId)}
						{@const mergedInto = project.mergedIntoProjectId
							? resolveProject(project.projectId, projectList)
							: null}
						<div class="admin-row" class:is-merged={Boolean(mergedInto)}>
							<span class="project-dot" style="background: {project.projectColor}"></span>
							<input
								class="admin-input is-name"
								value={project.projectName}
								disabled={Boolean(mergedInto)}
								oninput={(event) =>
									(projectList = projectList.map((candidate) =>
										candidate.projectId === project.projectId
											? { ...candidate, projectName: event.currentTarget.value }
											: candidate
									))}
							/>

							{#if mergedInto}
								<span class="admin-merged">→ {mergedInto.projectName}</span>
							{:else}
								<select
									class="admin-input is-client"
									value={project.clientId ?? ''}
									onchange={(event) =>
										(projectList = projectList.map((candidate) =>
											candidate.projectId === project.projectId
												? { ...candidate, clientId: event.currentTarget.value || null }
												: candidate
										))}
								>
									<option value="">Без клиента</option>
									{#each clientList as client (client.clientId)}
										<option value={client.clientId}>{client.clientName}</option>
									{/each}
								</select>

								<span class="admin-people">
									{#each employeesOfProject(project.projectId) as employee}
										<span class="admin-person">
											<img class="admin-avatar" src={employee?.avatarUrl} alt={employee?.employeeName} />
											<span class="person-card">
												<strong>{employee?.employeeName}</strong>
												<span>{employee?.employeeRole}</span>
												<span class="person-card-hours">
													{formatHours(
														taskList
															.filter(
																(task) =>
																	task.projectId === project.projectId &&
																	task.employeeId === employee?.employeeId
															)
															.reduce((sum, task) => sum + (hoursByTaskId[task.taskId] ?? 0), 0)
													)} ч в проекте
												</span>
											</span>
										</span>
									{/each}
								</span>

								<span class="admin-hours">{formatHours(hoursOfProject(project.projectId))} ч</span>

								<button
									class="icon-button-light admin-more"
									title="Все настройки проекта"
									onclick={() => openProjectEditor(project)}>⋯</button
								>

								<button class="pill-button" onclick={() => (mergingProjectId = project.projectId)}>
									Объединить
								</button>
							{/if}
						</div>
					{/each}
				</section>
			</div>
		{:else}
		<div class="toolbar">
			<div class="toolbar-group">
				<PeriodToolbar bind:selectedDate bind:viewMode bind:slideDirection {showWeekends} />
			</div>

			<GridToolbar
				bind:this={gridToolbar}
				bind:viewMode
				bind:searchQuery={filterQuery}
				projectsWithTasks={gridProjects}
				onFitColumns={() => weekGrid?.fitColumns()}
				onOpenShare={openShareModal}
				onOpenExcel={openExcelModal}
			>
				{#snippet leading()}
					{#if activeTab === 'studio'}
						<span class="boss-count">{employees.length} человек</span>
					{/if}
				{/snippet}
			</GridToolbar>
		</div>

		{#if activeTab === 'studio'}
			<div class="filter-bar">
				{@render groupMenu('group', 'Группировка', groupLabels[groupBy], [
					{ optionId: 'project', optionLabel: 'По проектам' },
					{ optionId: 'employee', optionLabel: 'По сотрудникам' },
					{ optionId: 'client', optionLabel: 'По клиентам' }
				])}

				{@render groupMenu(
					'badge',
					'Подпись',
					badgeLabels[rowBadge],
					[
						{ optionId: 'employee', optionLabel: 'Сотрудник' },
						{ optionId: 'project', optionLabel: 'Проект' },
						{ optionId: 'client', optionLabel: 'Клиент' },
						{ optionId: 'none', optionLabel: 'Без подписи' }
					].filter((option) => option.optionId !== groupBy)
				)}

				{@render groupMenu('sort', 'Сортировка', groupSort === 'name' ? 'По алфавиту' : 'По часам', [
					{ optionId: 'name', optionLabel: 'По алфавиту' },
					{ optionId: 'hours', optionLabel: 'По часам' }
				])}

				<span class="filter-divider"></span>

				{@render filterMenu('employee', 'Сотрудник', filterEmployeeIds, employees.map((employee) => ({
					optionId: employee.employeeId,
					optionLabel: employee.employeeName,
					optionColor: employee.employmentKind === 'outsource' ? '#6b6b6b' : '#28D059'
				})))}

				{@render filterMenu('client', 'Клиент', filterClientIds, clientList.map((client) => ({
					optionId: client.clientId,
					optionLabel: client.clientName,
					optionColor: '#3C65E7'
				})))}

				{@render filterMenu('project', 'Проект', filterProjectIds, projectList
					.filter((project) => !project.mergedIntoProjectId)
					.map((project) => ({
						optionId: project.projectId,
						optionLabel: project.projectName,
						optionColor: project.projectColor
					})))}

				<span class="filter-summary">
					{tasksInActiveTab.length} из {tasksOfActiveTab.length} задач
				</span>

				{#if activeFilterCount > 0}
					<button class="filter-reset" onclick={clearFilters}>Сбросить</button>
				{/if}
			</div>
		{/if}

		<WeekGrid
			bind:this={weekGrid}
			bind:projectsWithTasks={gridProjects}
			bind:hoursByTaskAndDate
			bind:selectedDate
			bind:viewMode
			{slideDirection}
			{showWeekends}
			{targetHoursPerDay}
			{minimumHoursPerDay}
			{roundToQuarterHour}
			taskBadgeOf={activeTab === 'studio' ? taskBadgeOf : null}
			onTaskOwnerClick={activeTab === 'studio'
				? (taskId) => (reassigningTaskId = taskId)
				: null}
			allowEntryMove
			onAddProject={addProjectFromTable}
			vacationDates={activeTab === 'mine' ? bossVacationDates : {}}
			searchQuery={activeTab === 'mine' ? filterQuery : ''}
			emptyHintText={activeTab === 'studio' && activeFilterCount > 0
				? 'Под фильтры не попала ни одна задача с часами в этом периоде — сбросьте фильтры или смените период.'
				: ''}
		/>
		{/if}
	</main>

	{#if editingClientId}
		<div class="modal-backdrop" onclick={() => (editingClientId = null)} role="presentation">
			<div class="modal" onclick={(event) => event.stopPropagation()} role="presentation">
				<h2>{editingClientId === 'new' ? 'Новый клиент' : 'Клиент'}</h2>

				<!-- svelte-ignore a11y_autofocus -->
				<input
					class="modal-input"
					placeholder="Название клиента"
					bind:value={clientDraft.clientName}
					autofocus
					onkeydown={(event) => {
						if (event.key === 'Enter') saveClientEditor();
					}}
				/>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Ставка за час</strong>
						<span>Подставляется в отчёт и счёт</span>
					</div>
					<div class="share-dates">
						<input
							class="modal-input is-compact is-rate-input"
							type="number"
							min="0"
							step="50"
							bind:value={clientDraft.hourlyRate}
						/>
						<select class="modal-input is-compact" bind:value={clientDraft.currency}>
							<option value="RUB">₽ RUB</option>
							<option value="USD">$ USD</option>
							<option value="EUR">€ EUR</option>
						</select>
					</div>
				</div>

				{#if editingClientId !== 'new'}
					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Часы за период</strong>
							<span>По проектам этого клиента</span>
						</div>
						<strong>{formatHours(hoursOfClient(clientDraft.clientId))} ч</strong>
					</div>
				{/if}

				<div class="modal-actions">
					{#if editingClientId !== 'new'}
						<button class="pill-button is-danger" onclick={() => deleteClient(clientDraft.clientId)}>
							Удалить
						</button>
					{/if}
					<button class="pill-button" onclick={() => (editingClientId = null)}>Отмена</button>
					<button class="pill-button is-dark" onclick={saveClientEditor}>Сохранить</button>
				</div>
			</div>
		</div>
	{/if}

	{#if editingProjectId}
		<div class="modal-backdrop" onclick={() => (editingProjectId = null)} role="presentation">
			<div class="modal" onclick={(event) => event.stopPropagation()} role="presentation">
				<h2>{editingProjectId === 'new' ? 'Новый проект' : 'Проект'}</h2>

				<!-- svelte-ignore a11y_autofocus -->
				<input
					class="modal-input"
					placeholder="Название проекта"
					bind:value={projectDraft.projectName}
					autofocus
					onkeydown={(event) => {
						if (event.key === 'Enter') saveProjectEditor();
					}}
				/>

				<div class="color-swatches">
					{#each projectColorPalette as paletteColor (paletteColor)}
						<button
							class="color-swatch"
							class:is-selected={projectDraft.projectColor === paletteColor}
							style="background: {paletteColor}"
							aria-label="Цвет проекта"
							onclick={() => (projectDraft.projectColor = paletteColor)}
						></button>
					{/each}
				</div>

				<select
					class="modal-input"
					value={projectDraft.clientId ?? ''}
					onchange={(event) => (projectDraft.clientId = event.currentTarget.value || null)}
				>
					<option value="">Без клиента</option>
					{#each clientList as client (client.clientId)}
						<option value={client.clientId}>{client.clientName}</option>
					{/each}
				</select>

				{#if editingProjectId !== 'new'}
					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Задачи и часы</strong>
							<span>{tasksOfProject(projectDraft.projectId).length} задач в проекте</span>
						</div>
						<strong>{formatHours(hoursOfProject(projectDraft.projectId))} ч</strong>
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Дубликат другого проекта?</strong>
							<span>Задачи переедут, людям придёт уведомление</span>
						</div>
						<button
							class="pill-button"
							onclick={() => {
								mergingProjectId = projectDraft.projectId;
								editingProjectId = null;
							}}
						>
							Объединить
						</button>
					</div>
				{/if}

				<div class="modal-actions">
					{#if editingProjectId !== 'new' && tasksOfProject(projectDraft.projectId).length === 0}
						<button class="pill-button is-danger" onclick={() => deleteProject(projectDraft.projectId)}>
							Удалить
						</button>
					{/if}
					<button class="pill-button" onclick={() => (editingProjectId = null)}>Отмена</button>
					<button class="pill-button is-dark" onclick={saveProjectEditor}>Сохранить</button>
				</div>
			</div>
		</div>
	{/if}

	{#if isAddPersonOpen}
		<div class="modal-backdrop" onclick={() => (isAddPersonOpen = false)} role="presentation">
			<div class="modal" onclick={(event) => event.stopPropagation()} role="presentation">
				<h2>{newPersonKind === 'staff' ? 'Пригласить в студию' : 'Добавить аутсорс'}</h2>
				<p class="modal-hint">
					{newPersonKind === 'staff'
						? 'Придёт письмо со ссылкой — до принятия человек в статусе «приглашён».'
						: 'Без аккаунта: строки и часы за него ведёте вы, платим по часовой ставке.'}
				</p>

				<!-- svelte-ignore a11y_autofocus -->
				<input class="modal-input" placeholder="Имя и фамилия" bind:value={newPersonName} autofocus />
				<input class="modal-input" placeholder="Роль" bind:value={newPersonRole} />

				{#if newPersonKind === 'staff'}
					<input class="modal-input" type="email" placeholder="Рабочий email" bind:value={newPersonEmail} />
					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Оклад в месяц</strong>
							<span>Видно только вам</span>
						</div>
						<input class="modal-input is-compact" type="number" min="0" step="5000" bind:value={newPersonSalary} />
					</div>
				{:else}
					<input class="modal-input" type="email" placeholder="Email для связи" bind:value={newPersonEmail} />
					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Ставка за час</strong>
							<span>Видно только вам</span>
						</div>
						<input class="modal-input is-compact" type="number" min="0" step="100" bind:value={newPersonRate} />
					</div>
				{/if}

				<div class="modal-actions">
					<button class="pill-button" onclick={() => (isAddPersonOpen = false)}>Отмена</button>
					<button class="pill-button is-dark" onclick={confirmAddPerson}>
						{newPersonKind === 'staff' ? 'Отправить приглашение' : 'Добавить'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if editingEmployee}
		<div class="modal-backdrop" onclick={() => (editingEmployeeId = null)} role="presentation">
			<div class="modal is-share" onclick={(event) => event.stopPropagation()} role="presentation">
				<div class="employee-card-header">
					<img class="avatar is-large" src={editingEmployee.avatarUrl} alt="" />
					<div class="employee-card-title">
						<h2>{editingEmployee.employeeName}</h2>
						<span>
							{editingEmployee.employmentKind === 'outsource' ? 'Аутсорс' : 'В штате'} ·
							{editingEmployee.employeeStatus === 'invited'
								? 'приглашён'
								: editingEmployee.employeeStatus === 'archived'
									? 'в архиве'
									: 'активен'}
						</span>
					</div>
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Роль</strong>
						<span>Как показывать в таблице</span>
					</div>
					<input
						class="modal-input is-compact"
						value={editingEmployee.employeeRole}
						oninput={(event) =>
							updateEmployee(editingEmployee.employeeId, {
								employeeRole: event.currentTarget.value
							})}
					/>
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Email</strong>
						<span>Логин и адрес для приглашений</span>
					</div>
					<input
						class="modal-input is-compact"
						type="email"
						value={editingEmployee.employeeEmail}
						oninput={(event) =>
							updateEmployee(editingEmployee.employeeId, {
								employeeEmail: event.currentTarget.value
							})}
					/>
				</div>

				{#if editingEmployee.employmentKind === 'staff'}
					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Пароль</strong>
							<span>Вы не видите пароль — только сбрасываете</span>
						</div>
						<button
							class="pill-button"
							onclick={() =>
								notifyEmployees(
									[editingEmployee.employeeId],
									'Ссылка на смену пароля отправлена на почту.'
								)}
						>
							Сбросить
						</button>
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Оклад в месяц</strong>
							<span>Видно только вам</span>
						</div>
						<input
							class="modal-input is-compact"
							type="number"
							min="0"
							step="5000"
							value={editingEmployee.monthlySalary}
							oninput={(event) =>
								updateEmployee(editingEmployee.employeeId, {
									monthlySalary: Number(event.currentTarget.value)
								})}
						/>
					</div>
				{:else}
					<div class="settings-row">
						<div class="settings-row-text">
							<strong>Ставка за час</strong>
							<span>Видно только вам · {formatHours(hoursOfEmployeeInPeriod(editingEmployee.employeeId))} ч за период</span>
						</div>
						<input
							class="modal-input is-compact"
							type="number"
							min="0"
							step="100"
							value={editingEmployee.outsourceHourlyRate}
							oninput={(event) =>
								updateEmployee(editingEmployee.employeeId, {
									outsourceHourlyRate: Number(event.currentTarget.value)
								})}
						/>
					</div>

					<div class="settings-row">
						<div class="settings-row-text">
							<strong>К выплате за период</strong>
							<span>Часы × ставка</span>
						</div>
						<strong class="employee-card-total">
							{Math.round(
								hoursOfEmployeeInPeriod(editingEmployee.employeeId) *
									editingEmployee.outsourceHourlyRate
							).toLocaleString('ru-RU')}
							{currencySymbols[editingEmployee.payCurrency]}
						</strong>
					</div>
				{/if}

				<div class="settings-row is-stacked">
					<div class="settings-row-text">
						<strong>Заметка</strong>
						<span>Для вас: чем занимается, договорённости</span>
					</div>
					<textarea
						class="modal-input"
						rows="2"
						value={editingEmployee.employeeNote}
						oninput={(event) =>
							updateEmployee(editingEmployee.employeeId, {
								employeeNote: event.currentTarget.value
							})}
					></textarea>
				</div>

				<div class="modal-actions">
					{#if editingEmployee.employeeStatus === 'archived'}
						<button class="pill-button" onclick={() => restoreEmployee(editingEmployee.employeeId)}>
							Вернуть из архива
						</button>
					{:else}
						{#if editingEmployee.employeeStatus === 'invited'}
							<button class="pill-button" onclick={() => resendInvite(editingEmployee.employeeId)}>
								Отправить приглашение снова
							</button>
						{/if}
						{#if !editingEmployee.isBoss}
							<button
								class="pill-button is-danger"
								onclick={() => archiveEmployee(editingEmployee.employeeId)}
							>
								В архив
							</button>
						{/if}
					{/if}
					<button class="pill-button is-dark" onclick={() => (editingEmployeeId = null)}>
						Готово
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if isShareModalOpen}
		<div class="modal-backdrop" onclick={() => (isShareModalOpen = false)} role="presentation">
			<div class="modal is-share" onclick={(event) => event.stopPropagation()} role="presentation">
				<h2>Публичная ссылка на отчёт</h2>

				<div class="settings-row is-stacked">
					<div class="settings-row-text">
						<strong>Что попадёт в отчёт</strong>
						<span>Пусто — значит всё: вся студия, все проекты, все сотрудники</span>
					</div>
					<div class="share-pickers">
						{@render sharePicker('clients', 'Клиенты', shareClientIds, clientList.map((client) => ({
							optionId: client.clientId,
							optionLabel: client.clientName
						})))}
						{@render sharePicker('projects', 'Проекты', shareProjectIds, liveProjects.map((project) => ({
							optionId: project.projectId,
							optionLabel: project.projectName
						})))}
						{@render sharePicker('employees', 'Сотрудники', shareEmployeeIds, employees.map((employee) => ({
							optionId: employee.employeeId,
							optionLabel: employee.employeeName
						})))}
					</div>
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Период</strong>
						<span>Какие дни попадут в отчёт</span>
					</div>
					<div class="share-dates">
						<input class="modal-input is-compact" type="date" bind:value={shareFromDate} />
						<input class="modal-input is-compact" type="date" bind:value={shareToDate} />
					</div>
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Сумма по ставке клиента</strong>
						<span>
							{shareRateClient
								? `${shareRateClient.hourlyRate.toLocaleString('ru-RU')} ${currencySymbols[shareRateClient.currency]}/ч`
								: 'Ставка подставляется, когда выбран один клиент'}
						</span>
					</div>
					<input type="checkbox" class="settings-switch" bind:checked={shareIncludeRate} />
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Кто делал</strong>
						<span>Имя сотрудника в строке</span>
					</div>
					<input type="checkbox" class="settings-switch" bind:checked={shareShowPeople} />
				</div>

				<div class="settings-row">
					<div class="settings-row-text">
						<strong>Описания задач</strong>
						<span>Показывать текст под названием</span>
					</div>
					<input type="checkbox" class="settings-switch" bind:checked={shareShowDescriptions} />
				</div>

				<div class="share-link-row">
					<input class="modal-input is-compact share-link-input" readonly value={shareLink} />
					<button class="pill-button" onclick={copyShareLink}>
						{isShareLinkCopied ? 'Скопировано' : 'Копировать'}
					</button>
				</div>

				<div class="modal-actions">
					<button class="pill-button" onclick={() => (isShareModalOpen = false)}>Закрыть</button>
					<a class="pill-button is-dark" href={shareLinkPath} target="_blank" rel="noreferrer">
						Открыть отчёт
					</a>
				</div>
			</div>
		</div>
	{/if}

	{#if mergingProjectId}
		<div class="modal-backdrop" onclick={() => (mergingProjectId = null)} role="presentation">
			<div class="modal" onclick={(event) => event.stopPropagation()} role="presentation">
				<h2>Объединить с проектом</h2>
				<p class="modal-hint">
					Задачи и часы переедут, а сотрудники получат уведомление об изменении.
				</p>
				<div class="employee-picker">
					{#each liveProjects.filter((project) => project.projectId !== mergingProjectId) as project (project.projectId)}
						<button class="employee-option" onclick={() => mergeProjectInto(project.projectId)}>
							<span class="project-dot" style="background: {project.projectColor}"></span>
							<span class="employee-option-text">
								<strong>{project.projectName}</strong>
								<span>{clientById(project.clientId)?.clientName ?? 'Без клиента'}</span>
							</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if reassigningTaskId}
		<div class="modal-backdrop" onclick={() => (reassigningTaskId = null)} role="presentation">
			<div class="modal" onclick={(event) => event.stopPropagation()} role="presentation">
				<h2>Кому передать задачу</h2>
				<div class="employee-picker">
					{#each employees as employee (employee.employeeId)}
						<button class="employee-option" onclick={() => reassignTaskTo(employee.employeeId)}>
							<img class="employee-avatar" src={employee.avatarUrl} alt="" />
							<span class="employee-option-text">
								<strong>{employee.employeeName}</strong>
								<span>{employee.employeeRole}</span>
							</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if isNewTaskModalOpen}
		<div class="modal-backdrop" onclick={() => (isNewTaskModalOpen = false)} role="presentation">
			<div class="modal" onclick={(event) => event.stopPropagation()} role="presentation">
				<h2>Новая задача</h2>

				<!-- svelte-ignore a11y_autofocus -->
				<input
					class="modal-input"
					placeholder="Название задачи"
					bind:value={newTaskTitle}
					autofocus
					onkeydown={(event) => {
						if (event.key === 'Enter') confirmNewTask();
					}}
				/>

				<select class="modal-input" bind:value={newTaskEmployeeId}>
					{#each employees as employee (employee.employeeId)}
						<option value={employee.employeeId}>
							{employee.employeeName}{employee.employmentKind === 'outsource' ? ' · аутсорс' : ''}
						</option>
					{/each}
				</select>

				<select class="modal-input" bind:value={newTaskProjectId}>
					{#each projectList.filter((project) => !project.mergedIntoProjectId) as project (project.projectId)}
						<option value={project.projectId}>{project.projectName}</option>
					{/each}
					<option value={newProjectOptionId}>+ Новый проект…</option>
				</select>

				{#if newTaskProjectId === newProjectOptionId}
					<input
						class="modal-input"
						placeholder="Название нового проекта"
						bind:value={newTaskNewProjectName}
						onkeydown={(event) => {
							if (event.key === 'Enter') confirmNewTask();
						}}
					/>
				{/if}

				<div class="modal-actions">
					<button class="pill-button" onclick={() => (isNewTaskModalOpen = false)}>Отмена</button>
					<button class="pill-button is-dark" onclick={confirmNewTask}>Создать</button>
				</div>
			</div>
		</div>
	{/if}

	<Sidebar
		bind:selectedDate
		bind:isSidebarOpen
		hoursByTaskAndDate={bossOwnHours}
		targetHoursPerDay={targetHoursPerDayPerPerson}
		employeeId={bossEmployeeId}
		userName={boss?.employeeName}
		userRole={boss?.employeeRole}
		avatarUrl={boss?.avatarUrl}
		userEmail={boss?.employeeEmail}
		workspaceName={studioProfile.studioName}
		{interfaceLanguages}
		bind:interfaceLanguage
		{workspaces}
		{currentWorkspaceId}
		onRequestNewTask={openNewTaskModal}
		onOpenSettings={(tab) => openSettingsAt(tab as SettingsTab)}
	/>

	<ExcelModal
		bind:isOpen={isExcelModalOpen}
		mode={excelMode}
		isStacked={isSettingsOpen}
		projectsWithTasks={gridProjects}
		{hoursByTaskAndDate}
		periodFromDate={toIsoDate(reportDates[0] ?? selectedDate)}
		periodToDate={toIsoDate(reportDates[reportDates.length - 1] ?? selectedDate)}
	/>

	{#if isSettingsOpen}
		<SettingsModal
			bind:isSettingsOpen
			bind:settingsTab
			projectsWithTasks={gridProjects}
			bind:targetHoursPerDay={targetHoursPerDayPerPerson}
			bind:minimumHoursPerDay
			bind:workDaysPerWeek
			bind:workDayStartHour
			bind:workDayEndHour
			bind:roundToQuarterHour
			bind:showWeekends={showWeekendsSetting}
			bind:accentPreference
			bind:appearanceFont
			bind:appearanceBaseFontSize
			bind:appearanceRowPadding
			bind:interfaceLanguage
			{interfaceLanguages}
			{workspaces}
			bind:currentWorkspaceId
			userName={boss?.employeeName ?? ''}
			userRole={boss?.employeeRole ?? ''}
			avatarUrl={boss?.avatarUrl ?? ''}
			userEmail={boss?.employeeEmail ?? ''}
			onOpenExcel={openExcelModal}
		/>
	{/if}
</div>

<style>
	.boss-layout {
		display: grid;
		grid-template-columns: 1fr clamp(15rem, 18vw, 20rem);
		height: 100dvh;
		background: var(--color-shell);
		padding: 0.5rem;
		gap: 0.5rem;
		overflow: hidden;
		transition: grid-template-columns 0.15s ease;
	}

	.boss-layout.is-sidebar-collapsed {
		grid-template-columns: 1fr 3.5rem;
	}

	.boss-main {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--color-panel);
		border-radius: 0.875rem;
		overflow: hidden;
	}

	.boss-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.625rem 0.875rem;
		border-bottom: 1px solid var(--color-border);
	}

	.boss-tabs {
		display: flex;
		gap: 0.25rem;
	}

	.boss-tab {
		border: 0;
		background: transparent;
		border-radius: 0.5rem;
		padding: 0.4375rem 0.75rem;
		font: inherit;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
		cursor: pointer;
	}

	.boss-tab:hover {
		background: var(--color-hover-tint);
	}

	.tab-badge {
		margin-left: 0.3125rem;
		padding: 0.0625rem 0.3125rem;
		border-radius: 999px;
		background: var(--color-weekend);
		color: #ffffff;
		font-size: 0.6875rem;
	}

	.boss-tab.is-active {
		background: var(--color-cell-tint);
		color: var(--color-text);
		font-weight: 500;
	}





	.boss-count {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.filter-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.875rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-cell-tint);
	}

	.filter-divider {
		width: 1px;
		height: 1.25rem;
		background: var(--color-border);
	}

	.filter-button.is-active {
		background: var(--color-shell);
		color: #ffffff;
	}

	.filter-option {
		display: flex;
		align-items: center;
		gap: 0.4375rem;
	}

	.filter-option.is-checked {
		font-weight: 500;
	}

	.filter-check {
		margin-left: auto;
		color: var(--color-day-full-text);
	}


	.filter-summary {
		margin-left: auto;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.filter-reset {
		border: 0;
		background: transparent;
		font: inherit;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		cursor: pointer;
		text-decoration: underline;
	}

	.admin-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 1rem 0.875rem 2rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.admin-title {
		margin: 0;
		font-size: 0.9375rem;
	}

	.admin-hint {
		margin: 0.25rem 0 0.625rem;
		font-size: 0.75rem;
		color: var(--color-text-muted);
		max-width: 38rem;
	}

	.admin-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.admin-input {
		border: 1px solid transparent;
		border-radius: 0.375rem;
		padding: 0.25rem 0.375rem;
		font: inherit;
		font-size: 0.8125rem;
		background: transparent;
		color: inherit;
	}

	.admin-input:hover:not(:disabled) {
		border-color: var(--color-border);
	}

	.admin-input:focus {
		outline: none;
		border-color: var(--color-text);
		background: var(--color-panel);
	}

	.admin-input.is-name {
		width: 11rem;
		font-weight: 500;
	}

	.admin-input.is-rate {
		width: 5rem;
		text-align: right;
	}

	.admin-input.is-currency,
	.admin-input.is-client {
		border-color: var(--color-border);
		font-size: 0.75rem;
	}

	.admin-more {
		background: transparent;
		border: 1px solid var(--color-border);
		color: var(--color-text-muted);
		font-size: 0.875rem;
		line-height: 1;
	}

	.admin-more:hover {
		background: var(--color-hover-tint);
		color: var(--color-text);
	}





	.admin-person {
		position: relative;
		display: inline-flex;
	}

	/* Floating card so the boss can tell who the avatars are. */
	.person-card {
		position: absolute;
		bottom: calc(100% + 0.375rem);
		left: 50%;
		transform: translateX(-50%) translateY(0.25rem);
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		width: max-content;
		max-width: 14rem;
		padding: 0.4375rem 0.5625rem;
		border-radius: 0.5rem;
		background: var(--color-shell);
		color: #ffffff;
		font-size: 0.6875rem;
		line-height: 1.3;
		box-shadow: 0 0.375rem 1rem rgb(0 0 0 / 0.28);
		opacity: 0;
		pointer-events: none;
		transition:
			opacity 0.12s ease,
			transform 0.12s ease;
	}

	.admin-person:hover .person-card {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}

	.person-card span {
		color: var(--color-text-on-shell);
	}

	.person-card-hours {
		color: var(--color-day-full-text);
	}

	.is-rate-input {
		width: 6rem;
		text-align: right;
	}

	.color-swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.color-swatch {
		width: 1.375rem;
		height: 1.375rem;
		border: 2px solid transparent;
		border-radius: 50%;
		cursor: pointer;
	}

	.color-swatch.is-selected {
		border-color: var(--color-text);
	}

	/* Shown instead of a list when there is genuinely nothing yet. */
	.admin-blank {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 1.5rem 0;
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.admin-blank strong {
		color: var(--color-text);
		font-size: 0.875rem;
	}

	.admin-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4375rem 0;
		border-bottom: 1px solid var(--color-border);
		font-size: 0.8125rem;
	}

	.admin-row.is-merged {
		opacity: 0.55;
	}







	.admin-projects,
	.admin-people {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-wrap: wrap;
		flex: 1;
		min-width: 0;
	}

	.admin-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.4375rem;
		border-radius: 999px;
		background: var(--color-cell-tint);
		font-size: 0.75rem;
	}

	.admin-empty,
	.admin-merged {
		flex: 1;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.admin-avatar {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		object-fit: cover;
	}

	.admin-hours,
	.admin-total {
		min-width: 6rem;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.admin-total {
		font-weight: 500;
	}

	.modal.is-share {
		width: min(94vw, 30rem);
	}

	.settings-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.settings-row:last-of-type {
		border-bottom: 0;
	}

	.settings-row-text {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.settings-row-text strong {
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.settings-row-text span {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.settings-row.is-stacked {
		flex-direction: column;
		align-items: stretch;
		gap: 0.5rem;
	}

	.share-pickers {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.share-dates {
		display: flex;
		gap: 0.375rem;
	}

	.share-link-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.share-link-input {
		flex: 1;
		min-width: 0;
		color: var(--color-text-muted);
	}

	.employee-card-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.employee-card-title h2 {
		margin: 0;
	}

	.employee-card-title span {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.employee-card-total {
		font-variant-numeric: tabular-nums;
	}

	.team-summary {
		padding: 0.75rem 0.875rem;
		border-bottom: 1px solid var(--color-border);
	}

	.report-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.5rem;
	}

	.report-card {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem 0.875rem;
		border-radius: 0.625rem;
		background: var(--color-cell-tint);
	}

	.report-card-label {
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.report-card-value {
		font-size: 1.0625rem;
	}




	.modal-hint {
		margin: 0;
		font-size: 0.75rem;
		color: var(--color-text-muted);
	}

	.modal {
		background: var(--color-panel);
		border-radius: 0.875rem;
		padding: 1.125rem;
		width: min(92vw, 24rem);
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.modal h2 {
		margin: 0;
		font-size: 0.9375rem;
	}

	.employee-picker {
		display: flex;
		flex-direction: column;
	}

	.employee-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 0;
		background: transparent;
		border-radius: 0.5rem;
		padding: 0.4375rem 0.5rem;
		font: inherit;
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
	}

	.employee-option:hover {
		background: var(--color-hover-tint);
	}

	.employee-avatar {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		object-fit: cover;
	}

	.employee-option-text {
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}

	.employee-option-text span {
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}


	.toolbar-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.toolbar-group-right {
		margin-left: auto;
	}
</style>
