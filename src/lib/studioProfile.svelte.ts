// The studio itself: what clients see on a report. Prototype — in memory, so a
// reload forgets the logo; the shape is what the `studios` table will hold.

export type StudioProfile = {
	studioName: string;
	// Data URL while there is no storage bucket. Real one will be a file path.
	logoDataUrl: string;
	logoFileName: string;
};

export const studioProfile = $state<StudioProfile>({
	studioName: 'Radiance',
	logoDataUrl: '',
	logoFileName: ''
});

// 400 KB keeps a data URL small enough to carry around in memory.
export const maximumLogoBytes = 400 * 1024;

export type LogoReadResult = { errorText: string };

export async function readLogoFile(file: File): Promise<LogoReadResult> {
	if (!file.type.startsWith('image/')) {
		return { errorText: 'Нужен файл-картинка: PNG, SVG или JPG.' };
	}
	if (file.size > maximumLogoBytes) {
		return { errorText: 'Файл больше 400 КБ — возьмите версию поменьше.' };
	}

	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});

	studioProfile.logoDataUrl = dataUrl;
	studioProfile.logoFileName = file.name;
	return { errorText: '' };
}

export function removeLogo() {
	studioProfile.logoDataUrl = '';
	studioProfile.logoFileName = '';
}
