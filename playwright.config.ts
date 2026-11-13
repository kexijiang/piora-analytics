import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/ui',fullyParallel:false,workers:1,retries:0,
 use:{baseURL:'http://127.0.0.1:4318',viewport:{width:1600,height:1050},locale:'zh-CN',timezoneId:'Asia/Shanghai',colorScheme:'light',screenshot:'only-on-failure',trace:'retain-on-failure',...(process.platform==='win32'?{channel:'msedge'}:{})},
 projects:[{name:'chromium',use:{browserName:'chromium'}}],
 webServer:{command:'npm run dev',url:'http://127.0.0.1:4318',reuseExistingServer:!process.env.CI,timeout:60000},
 reporter:[['list'],['html',{open:'never'}]]
});
