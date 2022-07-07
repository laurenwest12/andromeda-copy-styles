const express = require('express');
const app = express();

const { type } = require('./config.js');
const { andromedaAuthorization } = require('./authorization.js');
const { sendErrorReport } = require('./functions/errorReporting.js');
const {
  connectDb,
  submitAllQueries,
  getSQLServerData,
  getLastRunTime,
} = require('./sql');
const { getAndromedaData, updateAndromedaData } = require('./andromeda.js');

const server = app.listen(6000, async () => {
  console.log('App is listening...');
  const errors = [];
  try {
    await andromedaAuthorization();
    await connectDb();

    // 1. Get the last time the program was ran
    // const lastRunTime = await getLastRunTime('SourceStyleImport', 'CreatedOn');
    const lastRunTime = '2020-06-01T12:21:26.000Z';

    // 2. Get all styles that have a source style
    const data = await getAndromedaData(
      'ECHO-DevelopmentStyleSourceCreatedOn-1',
      lastRunTime
    );

    // 3. Insert into SourceStyleImport
    const submitErrors = await submitAllQueries(data, 'SourceStyleImportNew');
    errors.push(submitErrors);

    // // 4. Get all styles from SourceStyleImport where AndromedaProcessed = 'No'. This is done separately to make sure we are updating any styles that could not get updated the previous run because someone was currently editing the style in Andromeda.
    // const stylesToUpdate = await getSQLServerData(
    //   'SourceStyleImport',
    //   `WHERE AndromedaProcessed = 'No'`
    // );

    // // 5. Update carry forward flag to false in Andromeda and update AndromedaProcessed = 'Yes' if update was successful
    // const updateErrors = await updateAndromedaData(stylesToUpdate);
    // errors.push(updateErrors);
  } catch (err) {
    errors.push({
      type,
      err: err?.message,
    });
  }

  if (errors.flat().length) {
    await sendErrorReport(errors.flat(), type);
  }

  process.kill(process.pid, 'SIGTERM');
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Process terminated');
  });
});
