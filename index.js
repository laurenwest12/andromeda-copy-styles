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
const {
  getAndromedaData,
  updateAndromedaData,
  updateNuOrderFlags,
} = require('./andromeda.js');

const server = app.listen(6024, async () => {
  console.log('App is listening...');
  const errors = [];
  try {
    await andromedaAuthorization();
    await connectDb();

    // // 1. Get the last time the program was ran
    // const lastRunTime = await getLastRunTime(
    //   'SourceStyleImport',
    //   'TransactionOn'
    // );

    const lastRunTime = '2022-08-14T16:31:48.499336+00:00';

    // // 2. Get all styles that have a source style
    // const data = await getAndromedaData(
    //   'ECHO-DevelopmentStyleSourceCreatedOn-1',
    //   lastRunTime
    // );

    // 2. Get the styles that have been flipped to ERP ready and have a source style
    const data = await getAndromedaData(
      'ECHO-HistoryModifiedOnByTableAndField',
      {
        getafterdate: lastRunTime,
        table: 'DevelopmentStyle',
        field: 'isexportready',
      }
    );

    // 3. Insert into SourceStyleImport
    const submitErrors = await submitAllQueries(data, 'SourceStyleImport');
    errors.push(submitErrors);

    // 4. Update the MarketSeason for just imported styles to determine the CF flag
    await submitQuery(`
    UPDATE SourceStyleImport
    SET MarketSeason = S.[MarketSeason-Legacy]
    FROM SourceStyleImport I INNER JOIN
    [ECDB].[dbo].[SeasonSettings] S on I.Season = S.WriteupSeason
    WHERE CarryForwardProcessed = 'No'`);

    // 5. Update the SourceMarketSeason for just imported styles to determine the CF flag
    await submitQuery(`
    UPDATE SourceStyleImport
    SET SourceMarketSeason = S.[MarketSeason-Legacy]
    FROM SourceStyleImport I INNER JOIN
    [ECDB].[dbo].[SeasonSettings] S on I.SourceSeason = S.WriteupSeason
    WHERE CarryForwardProcessed = 'No'`);

    /* 6. Update AndromedaProcessed = 'Yes' when nothing needs to be changed.
          CARRY FORWARDS
              1. CarryForward = 'Yes'
                  - Style = SourceStyle
                  - MarketSeason <> SourceMarketSeason
              2. CarryForward = 'No'
                  - Style <> SourceStyle
              3. CarryForward = 'No'
                  - Style = SourceStyle
                  - MarketSeason = SourceMarketSeason
          ORIGINAL SEASON YEAR
              1. SourceStyle = Style
                 - OriginalSeasonYear <> Season
              2. SourceStyle <> Style
                 - OriginalSeasonYear = Season
    */

    // CARRY FORWARD PROCESSED FLAG
    //1.
    await submitQuery(`
      UPDATE SourceStyleImport
      SET CarryForwardProcessed = 'Yes'
      WHERE CarryForward = 'Yes' and Style = SourceStyle and MarketSeason <> SourceMarketSeason
      `);

    //2.
    await submitQuery(`
      UPDATE SourceStyleImport
      SET CarryForwardProcessed = 'Yes'
      WHERE CarryForward = 'No' and Style <> SourceStyle
      `);

    //3.
    await submitQuery(`
      UPDATE SourceStyleImport
      SET CarryForwardProcessed = 'Yes'
      WHERE CarryForward = 'No' and Style = SourceStyle and MarketSeason = SourceMarketSeason
      `);

    // ORIGINAL SEASON YEAR PROCESSED FLAG
    //1.
    await submitQuery(`
    UPDATE SourceStyleImport
    SET OriginalSeasonYearProcessed = 'Yes'
    WHERE Style = SourceStyle and OriginalSeasonYear <> Season
    `);

    await submitQuery(`
    UPDATE SourceStyleImport
    SET OriginalSeasonYearProcessed = 'Yes'
    WHERE Style <> SourceStyle and OriginalSeasonYear = Season
    `);

    // /* 4. Update AndromedaProcessed = 'Yes' where nothing needs to be changed in Andromeda....
    //       1. The Source Style <> Style and CarryForward = 'No' and OriginalSeasonYear = Season
    //       2. The Source Style = Style and CarryForward = 'Yes' and OriginalSeasonYear <> Season
    // */

    // await submitQuery(`
    // UPDATE SourceStyleImport SET AndromedaProcessed = 'Yes'
    // WHERE
    // ((Style = SourceStyle) AND
    // (CarryForward = 'Yes' and OriginalSeasonYear <> Season))
    // OR
    // ((Style <> SourceStyle) AND
    // (CarryForward = 'No' and Season = OriginalSeasonYear))
    // `);

    // // 5. Get all styles from SourceStyleImport where AndromedaProcessed = 'No' and SourceStyle = Style
    // const carryForwards = await getSQLServerData(
    //   'SourceStyleImport',
    //   `WHERE AndromedaProcessed = 'No' and SourceStyle = Style`
    // );

    // // 6. Update carry forward flag to true in Andromeda and update AndromedaProcessed = 'Yes' if update was successful
    // const updateCFErrors = await updateAndromedaData(carryForwards, true);
    // errors.push(updateCFErrors);

    // // 7. Get all styles from SourceStyleImport where AndromedaProcessed = 'No' and SourceStyle <> Style
    // const nonCarryForwards = await getSQLServerData(
    //   'SourceStyleImport',
    //   `WHERE AndromedaProcessed = 'No' and SourceStyle <> Style`
    // );

    // // 8. Update carry forward flag to true in Andromeda and update AndromedaProcessed = 'Yes' if update was successful
    // const updateNonCFErrors = await updateAndromedaData(
    //   nonCarryForwards,
    //   false
    // );
    // errors.push(updateNonCFErrors);
  } catch (err) {
    errors.push({
      type,
      err: err?.message,
    });
  }

  if (errors.flat().length) {
    console.log(errors);
    // await sendErrorReport(errors.flat(), type);
  }

  process.kill(process.pid, 'SIGTERM');
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Process terminated');
  });
});
