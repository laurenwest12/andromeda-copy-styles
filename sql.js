const sql = require('mssql');
const { server, database, sqlUser, sqlPass } = require('./config.js');

const pool = new sql.ConnectionPool({
  user: sqlUser,
  password: sqlPass,
  server,
  database,
  trustServerCertificate: true,
  requestTimeout: 500000,
});

const connectDb = async () => {
  await pool.connect();
  return 'Complete';
};

const getLastRunTime = async (table, field) => {
  const res = await pool.query(
    `SELECT TOP 1 * FROM ${table} ORDER BY ${field} DESC`
  );
  return res?.recordset[0][field];
};

const getValues = (data) => {
  const values = Object.values(data);
  let sqlValues = `(`;
  values.map((value, index) => {
    index === values.length - 1
      ? (sqlValues += `'${value}')`)
      : (sqlValues += `'${value}',`);
  });
  return sqlValues;
};

const getSQLServerData = async (table, where) => {
  const query = `SELECT * FROM ${table} ${where ? where : ''}`;
  const res = await pool.query(query);
  return res?.recordset;
};

const insertStatement = (table, values) => {
  return `INSERT INTO ${table} VALUES ${values}`;
};

const executeProcedure = async (proc) => {
  await pool.request().execute(proc);
  return 'Complete';
};

const submitQuery = async (query) => {
  await pool.query(query);
};

const submitAllQueries = async (data, table) => {
  const errors = [];
  for (let i = 0; i < data.length; ++i) {
    const values = getValues(data[i]);
    const query = insertStatement(table, values);
    try {
      await submitQuery(query);
    } catch (err) {
      errors.push({
        query,
        err: err?.message,
      });
    }
  }
  return errors;
};

module.exports = {
  connectDb,
  getLastRunTime,
  getSQLServerData,
  executeProcedure,
  submitQuery,
  submitAllQueries,
};
