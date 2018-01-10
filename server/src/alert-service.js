// @flow

const MySqlConnection = require('mysql-easier');

const {errorHandler} = require('./util/error-util');

import type {AlertType} from './types';

let mySql;

function alertService(
  app: express$Application,
  connection: MySqlConnection
): void {
  mySql = connection;

  const URL_PREFIX = '/alerts/:instanceId';

  app.get(URL_PREFIX, getByInstanceHandler);
}

async function getInstanceAlerts(
  instanceId: number,
  includeDescendants: boolean
): Promise<AlertType[]> {
  console.log('alert-service.js getInstanceAlerts: instanceId =', instanceId);
  const sql =
    'select a.instanceId, t.name, a.timestamp ' +
    'from alert a, alert_type t ' +
    'where instanceId = ?';
  const alerts = await mySql.query(sql, instanceId);
  console.log('alert-service.js getInstanceAlerts: alerts =', alerts);

  if (includeDescendants) {
    const childIds = await getChildInstanceIds(instanceId);
    console.log('alert-service.js getByInstanceHandler: childIds =', childIds);

    const promises = childIds.map(childId =>
      getInstanceAlerts(childId, true));
    const results = await Promise.all(promises);
    for (const childAlerts of results) {
      alerts.push(...childAlerts);
    }
  }

  return ((alerts: any): AlertType[]);
}

async function getByInstanceHandler(
  req: express$Request,
  res: express$Response
): Promise<void> {
  const instanceId = Number(req.params.instanceId);
  try {
    const alerts = await getInstanceAlerts(instanceId, true);
    res.send(alerts);
  } catch (e) {
    // istanbul ignore next
    errorHandler(res, e);
  }
}

async function getChildInstanceIds(instanceId: number): Promise<number[]> {
  const sql = 'select id from instance where parentId=?';
  const rows = await mySql.query(sql, instanceId);
  return rows.map(row => row.id);
}

module.exports = {
  alertService,
  getByInstanceHandler
};
