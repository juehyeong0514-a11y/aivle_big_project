import { createApp } from 'file:///C:/Users/User/Desktop/aivle_big_project/backend/src/app.mjs';
const app = await createApp({ databasePath: 'C:/Users/User/Desktop/aivle_big_project/.omo/evidence/account-admin-manager-org-exam-qa/qa-database.json' });
const server = app.listen(0, '127.0.0.1', () => {
  const address = server.address();
  console.log(BASE_URL=http://127.0.0.1:);
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
