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
  updateCarryforwards,
  updateOriginalSeasonYear,
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

    // // const lastRunTime = '2022-08-14T16:31:48.499336+00:00';

    // // 2. Get the styles that have been flipped to ERP ready and have a source style
    // const data = await getAndromedaData(
    //   'ECHO-HistoryTransactionOnByTableAndField',
    //   {
    //     getafterdate: lastRunTime,
    //     table: 'DevelopmentStyle',
    //     field: 'isexportready',
    //   }
    // );

    // // 3. Insert into SourceStyleImport
    // const submitErrors = await submitAllQueries(data, 'SourceStyleImport');
    // errors.push(submitErrors);

    // // 4. Update the MarketSeason for just imported styles to determine the CF flag
    // await submitQuery(`
    // UPDATE SourceStyleImport
    // SET MarketSeason = S.[MarketSeason-Legacy]
    // FROM SourceStyleImport I INNER JOIN
    // [ECDB].[dbo].[SeasonSettings] S on I.Season = S.WriteupSeason
    // WHERE CarryForwardProcessed = 'No'`);

    // // 5. Update the SourceMarketSeason for just imported styles to determine the CF flag
    // await submitQuery(`
    // UPDATE SourceStyleImport
    // SET SourceMarketSeason = S.[MarketSeason-Legacy]
    // FROM SourceStyleImport I INNER JOIN
    // [ECDB].[dbo].[SeasonSettings] S on I.SourceSeason = S.WriteupSeason
    // WHERE CarryForwardProcessed = 'No'`);

    // /* 6. Update AndromedaProcessed = 'Yes' when nothing needs to be changed.
    //       CARRY FORWARDS
    //           1. CarryForward = 'Yes'
    //               - Style = SourceStyle
    //               - MarketSeason <> SourceMarketSeason
    //           2. CarryForward = 'No'
    //               - Style <> SourceStyle
    //           3. CarryForward = 'No'
    //               - Style = SourceStyle
    //               - MarketSeason = SourceMarketSeason
    //       ORIGINAL SEASON YEAR
    //           1. SourceStyle = Style
    //              - OriginalSeasonYear <> Season
    //           2. SourceStyle <> Style
    //              - OriginalSeasonYear = Season
    // */

    // // CARRY FORWARD PROCESSED FLAG
    // //1.
    // await submitQuery(`
    //   UPDATE SourceStyleImport
    //   SET CarryForwardProcessed = 'Yes', CarryForwardProcessedTime = CURRENT_TIMESTAMP
    //   WHERE CarryForward = 'Yes' and Style = SourceStyle and MarketSeason <> SourceMarketSeason
    //   `);

    // //2.
    // await submitQuery(`
    //   UPDATE SourceStyleImport
    //   SET CarryForwardProcessed = 'Yes', CarryForwardProcessedTime = CURRENT_TIMESTAMP
    //   WHERE CarryForward = 'No' and Style <> SourceStyle
    //   `);

    // //3.
    // await submitQuery(`
    //   UPDATE SourceStyleImport
    //   SET CarryForwardProcessed = 'Yes', CarryForwardProcessedTime = CURRENT_TIMESTAMP
    //   WHERE CarryForward = 'No' and Style = SourceStyle and MarketSeason = SourceMarketSeason
    //   `);

    // // ORIGINAL SEASON YEAR PROCESSED FLAG
    // //1.
    // await submitQuery(`
    //   UPDATE SourceStyleImport
    //   SET OriginalSeasonYearProcessed = 'Yes', OriginalSeasonYearProcessedTime = CURRENT_TIMESTAMP
    //   WHERE Style = SourceStyle and OriginalSeasonYear <> Season
    //   `);

    // await submitQuery(`
    //   UPDATE SourceStyleImport
    //   SET OriginalSeasonYearProcessed = 'Yes', OriginalSeasonYearProcessedTime = CURRENT_TIMESTAMP
    //   WHERE Style <> SourceStyle and OriginalSeasonYear = Season
    //   `);

    //7. Get all styles where the CF flag needs to be updated and update in Andromeda
    const carryForwardsToUpdate = await getSQLServerData(
      'SourceStyleImport',
      `WHERE CarryforwardProcessed = 'No'`
    );
    const carryForwardErrors = await updateCarryforwards(carryForwardsToUpdate);
    carryForwardErrors.length && errors.push(carryForwardErrors);

    //8. Get all styles where the OriginalSeasonYear needs to be updated and update in Andromeda
    const originalSeasonYearUpdates = await getSQLServerData(
      'SourceStyleImport',
      `WHERE OriginalSeasonYearProcessed = 'No'`
    );
    const originalSeasonYearErrors = await updateOriginalSeasonYear(
      originalSeasonYearUpdates
    );

    originalSeasonYearErrors.length && errors.push(originalSeasonYearErrors);
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
