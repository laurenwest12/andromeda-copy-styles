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

const getSQLServerData = async (table, where) => {
  const query = `SELECT * FROM ${table} ${where ? where : ''}`;
  const res = await pool.query(query);
  return res?.recordset;
};

const insertTableStatement = (table, fields, values) => {
  return `SELECT *
    INTO ${table}
    FROM (VALUES ${values}) t1 ${fields}`;
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
  return 'Complete';
};

const submitAllQueries = async (fn, data, table) => {
  const errors = [];
  for (let i = 0; i < data.length; ++i) {
    const values = await fn(data[i]);
    const query = insertStatement(table, values);
    const res = await submitQuery(query);
    if (res.indexOf('Error') !== -1) {
      errors.push({ query, err: res, type: table });
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
