const axios = require('axios');
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

const updateNuOrderFlags = async (id) => {
  const res = await axios.get(`${url}/bo/DevelopmentStyle/${id}`);
  const { data } = res;
  const { Children } = data;
  const { developmentstylecolor } = Children;

  const errors = [];

  for (let i = 0; i < developmentstylecolor.length; ++i) {
    const { id_developmentstylecolor } = developmentstylecolor[i];

    try {
      const res = await axios.post(
        `${url}/bo/DevelopmentStyleColor/${id_developmentstylecolor}`,
        {
          Entity: {
            cat107: false,
          },
        }
      );
      if (!res.data.IsSuccess) {
        errors.push({
          idStyle: id_developmentstylecolor,
          err: `NuOrder Flag Not Cleared: ${res.data?.Result}`,
        });
      }
    } catch (err) {
      errors.push({
        idStyle: id_developmentstylecolor,
        err: `NuOrder Flag Not Cleared: ${err?.message}`,
      });
    }
  }

  return errors;
};

const updateAndromedaData = async (data, type) => {
  const errors = [];
  for (let i = 0; i < data.length; ++i) {
    const row = data[i];

    if (type === 'carryforward') {
      const { idStyle, CarryForward } = row;

      try {
        if (CarryForward === 'Yes') {
          const res = await axios.post(
            `${url}/bo/DevelopmentStyle/${idStyle}`,
            {
              Entity: {
                cat33: false,
              },
            }
          );

          res?.data?.IsSuccess &&
            updateProessedFlag(
              'SourceStyleImport',
              idStyle,
              'CarryForwardProcessed'
            );
        }

        if (CarryForward === 'No') {
          const res = await axios.post(
            `${url}/bo/DevelopmentStyle/${idStyle}`,
            {
              Entity: {
                cat33: true,
              },
            }
          );

          res?.data?.IsSuccess &&
            updateProessedFlag(
              'SourceStyleImport',
              idStyle,
              'CarryForwardProcessed'
            );
        }
      } catch (err) {
        errors.push({
          idStyle,
          err: err?.message,
        });
      }
    }
  }

  if (type === 'originalseasonyear') {
    const { idStyle, SourceSeason, SourceStyle, Season, Style, MarketSeason } =
      row;

    try {
      if (SourceStyle !== SourceSeason) {
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
      }
    } catch (err) {
      errors.push({
        idStyle,
        err: err?.message,
      });
    }
  }
};

// const updateAndromedaData = async (data, carryfoward) => {
//   const errors = [];

//   for (let i = 0; i < data.length; ++i) {
//     const { idStyle, Style, Season, OriginalSeasonYear } = data[i];
//     console.log(idStyle, Style, Season, OriginalSeasonYear);

//     if (carryfoward) {
//       try {
//         //1. Update the CarryForward flag to Yes
//         const res = await axios.post(`${url}/bo/DevelopmentStyle/${idStyle}`, {
//           Entity: {
//             cat33: true,
//           },
//         });

//         //2. Clear NuOrderApproved flag for all colors
//         const nuOrderFlagErrors = await updateNuOrderFlags(idStyle);
//         nuOrderFlagErrors.length && errors.push(nuOrderFlagErrors);

//         //3. Update the processed flags
//         res?.data?.IsSuccess &&
//           (await updateProessedFlag('SourceStyleImport', 'idStyle', idStyle));
//       } catch (err) {
//         errors.push({
//           idStyle,
//           err: err?.message,
//         });
//       }
//     } else {
//       try {
//         //1. Update the CarryForwardFlag to No and the OriginalSeasonYear to the current seaason
//         const res = await axios.post(`${url}/bo/DevelopmentStyle/${idStyle}`, {
//           Entity: {
//             cat33: false,
//             cat24: Season,
//           },
//         });

//         //2. Clear NuOrderApproved flag for all colors
//         const nuOrderFlagErrors = await updateNuOrderFlags(idStyle);
//         nuOrderFlagErrors.length && errors.push(nuOrderFlagErrors);

//         res?.data?.IsSuccess &&
//           (await updateProessedFlag('SourceStyleImport', 'idStyle', idStyle));
//       } catch (err) {
//         errors.push({
//           idStyle,
//           err: err?.message,
//         });
//       }
//     }
//   }

//   return errors;
// };

module.exports = {
  getAndromedaData,
  updateAndromedaData,
  updateNuOrderFlags,
};
