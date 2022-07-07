const axios = require('axios');
const { url } = require('./config.js');
const { updateProessedFlag } = require('./sql.js');

const getAndromedaData = async (query, start) => {
  // Get all development styles from Andromeda
  const res = await axios.post(`${url}/search/query/${query}`, {
    getafterdate: start,
  });

  // Create an array of only the relevant data for each development style
  const sourceStyleData = res.data.map(
    ({
      id_developmentstyle,
      season,
      style,
      sourcestyle,
      cat33,
      cat24,
      createdon,
    }) => {
      let SourceSeason = '';
      let SourceStyle = '';

      if (sourcestyle) {
        const sourceArr = sourcestyle.split(' ');
        SourceStyle = sourceArr[0];
        SourceSeason = sourceArr[1];
      }

      return {
        idStyle: id_developmentstyle,
        Season: season,
        Style: style,
        SourceSeason,
        SourceStyle,
        CarryForward: cat33 ? 'Yes' : 'No',
        OriginalSeasonYear: cat24,
        CreatedOn: createdon.substring(0, 19),
        AndromedaProcessed: 'No',
        AndromedaProcessedTime: '',
      };
    }
  );

  // Return only styles where the source style is not blank
  return sourceStyleData.filter(
    ({ SourceStyle, Season }) =>
      SourceStyle !== '' && Season !== 'NGC' && Season !== 'TEMPLATE'
  );

  // /*
  // 	Return only styles where...
  // 			1. The source style is not blank
  // 			2. The source style does not match the style number of the development style
  // 			3. The carry forward flag is set to true
  // 	These are the ones where the carry forward flag needs to be updated
  //  */
  // return sourceStyleData.filter(
  //   ({ SourceStyle, Style, CarryForward }) =>
  //     SourceStyle !== '' && SourceStyle !== Style && CarryForward === 'Yes'
  // );
};

const updateAndromedaData = async (data, carryfoward) => {
  const errors = [];

  for (let i = 0; i < data.length; ++i) {
    const { idStyle, Style, Season, OriginalSeasonYear } = data[i];
    console.log(idStyle, Style, Season, OriginalSeasonYear);

    if (carryfoward) {
      try {
        const res = await axios.post(`${url}/bo/DevelopmentStyle/${idStyle}`, {
          Entity: {
            cat33: true,
          },
        });

        res?.data?.IsSuccess &&
          (await updateProessedFlag(
            'SourceStyleImportNew',
            'idStyle',
            idStyle
          ));
      } catch (err) {
        errors.push({
          idStyle,
          err: err?.message,
        });
      }
    } else {
      try {
        const res = await axios.post(`${url}/bo/DevelopmentStyle/${idStyle}`, {
          Entity: {
            // cat33: false,
            cat24: Season,
          },
        });

        res?.data?.IsSuccess &&
          (await updateProessedFlag(
            'SourceStyleImportNew',
            'idStyle',
            idStyle
          ));
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
  updateAndromedaData,
};
