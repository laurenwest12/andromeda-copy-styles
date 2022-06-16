const express = require('express');
const app = express();

const { type } = require('./config.js');
const { andromedaAuthorization } = require('./authorization.js');
const { sendErrorReport } = require('./functions/errorReporting.js');
const { connectDb } = require('./sql');
const { getAndromedaData } = require('./andromeda.js');

const server = app.listen(6000, async () => {
  console.log('App is listening...');
  const errors = [];
  try {
    await andromedaAuthorization();
    await connectDb();

    const data = await getAndromedaData('DevelopmentStyle');
    console.log(data);

    // 1. Get all styles created after last run time
    // 2. Filter to only styles where the style number is different than the source style number and the carryforward flag is true
    // 3. Insert into SourceStyleImport
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
