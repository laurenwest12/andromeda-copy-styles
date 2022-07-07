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
  submitQuery,
} = require('./sql');
const { getAndromedaData, updateAndromedaData } = require('./andromeda.js');

const server = app.listen(6000, async () => {
  console.log('App is listening...');
  const errors = [];
  try {
    await andromedaAuthorization();
    await connectDb();

    // 1. Get the last time the program was ran
    const lastRunTime = await getLastRunTime('SourceStyleImport', 'CreatedOn');

    // 2. Get all styles that have a source style
    const data = await getAndromedaData(
      'ECHO-DevelopmentStyleSourceCreatedOn-1',
      lastRunTime
    );

    // 3. Insert into SourceStyleImport
    const submitErrors = await submitAllQueries(data, 'SourceStyleImport');
    errors.push(submitErrors);

    /* 4. Update AndromedaProcessed = 'Yes' where nothing needs to be changed in Andromeda....
          1. The Source Style <> Style and CarryForward = 'No' and OriginalSeasonYear = Season
          2. The Source Style = Style and CarryForward = 'Yes' and OriginalSeasonYear <> Season
    */

    await submitQuery(`
    UPDATE SourceStyleImport SET AndromedaProcessed = 'Yes'
    WHERE
    ((Style = SourceStyle) AND
    (CarryForward = 'Yes' and OriginalSeasonYear <> Season))
    OR
    ((Style <> SourceStyle) AND
    (CarryForward = 'No' and Season = OriginalSeasonYear))
    `);

    // 5. Get all styles from SourceStyleImport where AndromedaProcessed = 'No' and SourceStyle = Style
    const carryForwards = await getSQLServerData(
      'SourceStyleImport',
      `WHERE AndromedaProcessed = 'No' and SourceStyle = Style`
    );

    // 6. Update carry forward flag to true in Andromeda and update AndromedaProcessed = 'Yes' if update was successful
    const updateCFErrors = await updateAndromedaData(carryForwards, true);
    errors.push(updateCFErrors);

    // 7. Get all styles from SourceStyleImport where AndromedaProcessed = 'No' and SourceStyle <> Style
    const nonCarryForwards = await getSQLServerData(
      'SourceStyleImport',
      `WHERE AndromedaProcessed = 'No' and SourceStyle <> Style`
    );

    // 8. Update carry forward flag to true in Andromeda and update AndromedaProcessed = 'Yes' if update was successful
    const updateNonCFErrors = await updateAndromedaData(
      nonCarryForwards,
      false
    );
    errors.push(updateNonCFErrors);
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
