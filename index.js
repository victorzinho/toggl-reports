const https = require('https');
const moment = require('moment');
const markdownpdf = require('markdown-pdf');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json'));

const previousMonth = moment().utc();
if (config.month && config.month !== 'previous') {
  previousMonth.month(config.month);
} else {
  previousMonth.subtract(1, 'months');
}
const startDate = previousMonth.startOf('month').format();
const endDate = previousMonth.endOf('month').format();
const month = previousMonth.format('MMMM');

const options = {
  hostname: 'www.toggl.com',
  path: `/api/v8/time_entries?start_date=${startDate}&end_date=${endDate}`,
  method: 'GET',
  auth: `${config.token}:api_token`,
};

https.get(options, (resp) => {
  let data = '';

  resp.on('data', (chunk) => { data += chunk; });

  resp.on('end', () => {
    const response = JSON.parse(data);
    const summary = response
      .filter(entry => entry.pid == config.projectId)
      .map(entry => ({
        day: moment(entry.start).format(config.dayFormat),
        duration: entry.duration,
      }))
      .reduce((rv, x) => {
        rv[x.day] = (rv[x.day] || 0) + x.duration; // eslint-disable-line no-param-reassign
        return rv;
      }, {});
    let report = `# Time report for ${month}\n`;
    report += `## ${config.displayName}\n\n`;
    report += '| Day of the month | Time |\n';
    report += '|------------------|-------|\n';
    Object.keys(summary).forEach((key) => {
      report += `| ${key} | ${moment().startOf('day').seconds(summary[key]).format('H:mm')} |\n`;
    });

    const totalMinutes = Math.floor(Object.values(summary).reduce((a, b) => a + b, 0) / 60);
    const h = Math.floor(totalMinutes / 60);
    const m = (totalMinutes % 60).toString().padStart(2, '0');
    report += `|TOTAL|${h}:${m}|\n`;

    markdownpdf({ cssPath: './style.css' }).from.string(report).to('report.pdf');
  });
}).on('error', console.log); // eslint-disable-line no-console
