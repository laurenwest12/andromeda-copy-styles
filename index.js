const express = require('express');
const app = express();

const { type } = require('./config.js');
const { andromedaAuthorization } = require('./authorization.js');
const { sendErrorReport } = require('./functions/errorReporting.js');
const { connectDb, submitAllQueries } = require('./sql');
const { getAndromedaData } = require('./andromeda.js');

const server = app.listen(6000, async () => {
  console.log('App is listening...');
  const errors = [];
  try {
    await andromedaAuthorization();
    await connectDb();

    // 1. Get all styles created after last run time and filter to only styles that need to be updated
    const data = await getAndromedaData('DevelopmentStyle');

    // 2. Insert into SourceStyleImport
    const submitErrors = await submitAllQueries(data, 'SourceStyleImport');
    console.log(submitErrors);

    // 4. Get all styles from SourceStyleImport where AndromedaProcessed = 'No'
    // 5. Update carryforward flag to false in Andromeda
    // 6. Update AndromedaProcessed = 'Yes' if update was successful
  } catch (err) {
    errors.push({
      type,
      err: err?.message,
    });
  }

  if (errors.flat().length) {
    console.log(errors);
    //await sendErrorReport(errors.flat(), type);
  }

  process.kill(process.pid, 'SIGTERM');
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Process terminated');
  });
});
