import { defineConfig } from '@playwright/test';

export default defineConfig({

    projects: [
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
        },

        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                headless: false,
                storageState: 'authentications/localStorageSession.json',
            },
            dependencies: ['setup'],
        },
    ],
});