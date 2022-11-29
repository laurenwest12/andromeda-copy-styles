const axios = require('axios');
const { andromedaAuthorization } = require('./authorization.js');
const { url } = require('./config.js');
const { updateProessedFlag } = require('./sql.js');

const getAndromedaData = async (query, body) => {
  // Get all development styles from Andromeda
  let { data } = await axios.post(`${url}/search/query/${query}`, body);
  data = data.filter(({ newvalue }) => newvalue === 'True');
  console.log(data);
  const styles = [];

  for (let i = 0; i < data.length; ++i) {
    const { id_item, transactionon } = data[i];
    i % 50 === 0 && (await andromedaAuthorization());
    const styleRes = await axios.get(`${url}/bo/DevelopmentStyle/${id_item}`);
    const {
      id_developmentstyle,
      season,
      style,
      sourcestyle,
      cat33,
      cat24,
      createdon,
    } = styleRes.data.Entity;

    if (sourcestyle) {
      const sourceArr = sourcestyle.split(' ');
      const SourceStyle = sourceArr[0];
      const SourceSeason = sourceArr[1];
      styles.push({
        idStyle: id_developmentstyle,
        Season: season,
        Style: style,
        MarketSeason: '',
        SourceSeason,
        SourceStyle,
        SourceMarketSeason: '',
        CarryForward: cat33 ? 'Yes' : 'No',
        OriginalSeasonYear: cat24,
        CreatedOn: createdon,
        TransactionOn: transactionon,
        CarryForwardProcessed: 'No',
        CarryForwardProcessedTime: '',
        OriginalSeasonYearProcessed: 'No',
        OriginalSeasonYearProcessedTime: '',
      });
    }
  }

  return styles;

  // // Create an array of only the relevant data for each development style
  // const sourceStyleData = res.data.map(
  //   ({
  // id_developmentstyle,
  // season,
  // style,
  // sourcestyle,
  // cat33,
  // cat24,
  // createdon,
  //   }) => {
  //     let SourceSeason = '';
  //     let SourceStyle = '';

  //     if (sourcestyle) {
  //       const sourceArr = sourcestyle.split(' ');
  //       SourceStyle = sourceArr[0];
  //       SourceSeason = sourceArr[1];
  //     }

  //     return {
  //       idStyle: id_developmentstyle,
  //       Season: season,
  //       Style: style,
  //       SourceSeason,
  //       SourceStyle,
  //       CarryForward: cat33 ? 'Yes' : 'No',
  //       OriginalSeasonYear: cat24,
  //       CreatedOn: createdon.substring(0, 19),
  //       AndromedaProcessed: 'No',
  //       AndromedaProcessedTime: '',
  //     };
  //   }
  // );

  // // Return only styles where the source style is not blank
  // return sourceStyleData.filter(
  //   ({ SourceStyle, Season }) =>
  //     SourceStyle !== '' && Season !== 'NGC' && Season !== 'TEMPLATE'
  // );
};

const updateCarryforwards = async (data) => {
  const errors = [];
  for (let i = 0; i < data.length; ++i) {
    const { idStyle, CarryForward } = data[i];

    if (CarryForward.trim() === 'Yes') {
      try {
        const res = await axios.post(`${url}/bo/DevelopmentStyle/${idStyle}`, {
          Entity: {
            cat33: false,
          },
        });

        res?.data?.IsSuccess &&
          updateProessedFlag(
            'SourceStyleImport',
            idStyle,
            'CarryForwardProcessed'
          );
      } catch (err) {
        errors.push({
          idStyle,
          err: err?.message,
        });
      }
    }

    if (CarryForward.trim() === 'No') {
      try {
        const res = await axios.post(`${url}/bo/DevelopmentStyle/${idStyle}`, {
          Entity: {
            cat33: true,
          },
        });

        res?.data?.IsSuccess &&
          updateProessedFlag(
            'SourceStyleImport',
            idStyle,
            'CarryForwardProcessed'
          );
      } catch (err) {
        errors.push({
          idStyle,
          err: err?.message,
        });
      }
    }
  }
  return errors;
};

const updateOriginalSeasonYear = async (data) => {
  const errors = [];
  for (let i = 0; i < data.length; ++i) {
    const { idStyle, SourceSeason, SourceStyle, Season } = data[i];

    if (SourceStyle !== SourceSeason) {
      try {
        const res = await axios.post(`${url}/bo/DevelopmentStyle/${idStyle}`, {
          Entity: {
            cat24: Season,
          },
        });

        res?.data?.IsSuccess &&
          updateProessedFlag(
            'SourceStyleImport',
            idStyle,
            'OriginalSeasonYearProcessed'
          );
      } catch (err) {
        errors.push({
          idStyle,
          err: err?.message,
        });
      }
    }
  }
  return errors;
};

module.exports = {
  getAndromedaData,
  updateCarryforwards,
  updateOriginalSeasonYear,
};
