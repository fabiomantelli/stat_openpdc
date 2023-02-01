const Excel = require('exceljs');
const axios = require('axios')
const ppa = require('../models/PrimaryPhasorArchive')

exports.listStat = async (req, res) => {
  const { date, system } = req.body;
  const startTime = `${date} 00:00:00.000`;
  const endTime = `${date} 23:59:59.999`;

  let startPerformanceTime = performance.now();
  const statistic = await getStatisticFromOpenPDC(ppa[system], system, startTime, endTime);
  let endPerformanceTime = performance.now();
  let timeTaken = calculateTime(startPerformanceTime, endPerformanceTime)

  console.log(`Time taken to process request API openPDC: ${timeTaken} milliseconds.`);

  startPerformanceTime = performance.now()
  const flags = filterValues(statistic)
  endPerformanceTime = performance.now()
  timeTaken = calculateTime(startPerformanceTime, endPerformanceTime)
  console.log(`Time taken to filter and remove 0 and 64 values: ${timeTaken}.`)
  
  let items = [];
  startPerformanceTime = performance.now();
  const processedData = flags.reduce((acc, pmu, index) => {
    let newPmu = pmu[0];
    let previousTime = pmu[0] ? pmu[0].Time : '';

    pmu.reduce((pmuAcc, data, dataIndex) => {
      if (data.Value !== newPmu.Value ||
          pmu.length-1 === dataIndex ||
          new Date(data.Time).getTime() > new Date(previousTime).getTime() + 18) {
        pmuAcc.push({
          HistorianID: newPmu.HistorianID,
          InitialTime: newPmu.Time,
          FinalTime: pmu[dataIndex-1].Time,
          Interval: new Date(data.Time).getTime() - new Date(newPmu.Time).getTime(),
          Value: newPmu.Value,
          Quality: newPmu.Quality
        });
        newPmu = data;
      }
      previousTime = data.Time;
      return pmuAcc;
    }, acc);
    return acc;
  }, []);

  items = processedData;
  endPerformanceTime = performance.now();
  timeTaken = calculateTime(startPerformanceTime, endPerformanceTime)
  console.log(`Time taken to create new array with inicial and final time problem: ${timeTaken} milliseconds.`);


  const workbook = new Excel.Workbook();

  startPerformanceTime = performance.now();
  const dataByHistorian = items.reduce((result, item) => {
    const historianID = item.HistorianID;
    if (!result[historianID]) {
      result[historianID] = [];
    }
  
    const date = new Date(item.InitialTime);
    const dateStr = `${date.getUTCDate()}-${date.getUTCMonth() + 1}-${date.getUTCHours()}`;
    const binaryValue = parseInt(item.Value).toString(2);
    const binaryValueWithSpace = binaryValue.match(/.{1,4}/g).join(" ");
    const start = new Date(item.InitialTime);
    start.setHours(start.getHours() - 3);
    const end = new Date(item.FinalTime);
    end.setHours(end.getHours() - 3);
  
    result[historianID].push({
        Date: dateStr,
        "Status Flags openPDC hex": item.Value,
        "Status Flags binary openPDC": binaryValueWithSpace,
        "UTC Start": start,
        "UTC End": end,
        Period: new Date(item.Interval)
    });
  
    return result;
  }, {});
  
  endPerformanceTime = performance.now();
  timeTaken = calculateTime(startPerformanceTime, endPerformanceTime)
  
  console.log(`Time taken to group data by HistorianID: ${timeTaken} milliseconds.`);


  // Create a new sheet for each HistorianID
  startPerformanceTime = performance.now();
  for (let historian in dataByHistorian) {
      let sheet = workbook.addWorksheet(historian);

      // Add the header row
      sheet.columns = [
          { header: 'Data', key: 'Date' },
          { header: 'Status Flags openPDC hex', key: 'Status Flags openPDC hex' },
          { header: 'Status Flags binary openPDC', key: 'Status Flags binary openPDC' },
          { header: 'Início (UTC)', key: 'UTC Start' },
          { header: 'Fim (UTC)', key: 'UTC End' },
          { header: 'Período', key: 'Period' }
      ];

      // Add the data to the sheet
      sheet.addRows(dataByHistorian[historian]);
      //Formatting the columns 
      sheet.getColumn('C').numFmt = 'h:mm:ss.000';
      sheet.getColumn('D').numFmt = 'h:mm:ss.000';
      sheet.getColumn('E').numFmt = 'h:mm:ss.000';
      sheet.getColumn('F').numFmt = 'h:mm:ss.000';
  }

  // Save the workbook to an xlsx file
  workbook.xlsx.writeFile(`${date}.xlsx`).then(function () {
      console.log("File saved.");
  });

  endPerformanceTime = performance.now();
  timeTaken = calculateTime(startPerformanceTime, endPerformanceTime)
  console.log(`Time taken to save data into a Excel: ${timeTaken} milliseconds.`);

 
  res.json( {
      items: `Arquivo Excel do dia ${date} armazenado com sucesso.`
  })
}

function filterValues(data) {
  return data.map((pmu, index) => 
    pmu.filter(item => !(item.Value === 0 || item.Value === 64))
  )
}

function calculateTime(startTime, endTime) {
  return (endTime - startTime).toFixed(4) + ' milliseconds'
}

async function getStatisticFromOpenPDC(ppa, system, startTime, endTime) {
  const serverMap = {
    brazilianSystem: '150.162.19.214',
    sepPmu: '150.162.19.218',
    onsSystem: '192.168.253.21',
  };

  const server = serverMap[system];
  if (!server) {
    throw new Error(`Invalid system: ${system}`);
  }

  const data = [];

  for (let i = 0; i < ppa.length; i++) {
    try {
      const url = `http://${server}:6152/historian/timeseriesdata/read/historic/${ppa[i].statusFlags}/${startTime}/${endTime}/json`;
      const response = await axios.get(url);
      data[i] = response.data.TimeSeriesDataPoints;
    } catch (err) {
      console.error(err);
    }
  }

  return data;
}