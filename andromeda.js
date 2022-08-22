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

const updateAndromedaData = async (data, carryfoward) => {
  const errors = [];

  for (let i = 0; i < data.length; ++i) {
    const { idStyle, Style, Season, OriginalSeasonYear } = data[i];
    console.log(idStyle, Style, Season, OriginalSeasonYear);

    if (carryfoward) {
      try {
        //1. Update the CarryForward flag to Yes
        const res = await axios.post(`${url}/bo/DevelopmentStyle/${idStyle}`, {
          Entity: {
            cat33: true,
          },
        });

        //2. Clear NuOrderApproved flag for all colors
        const nuOrderFlagErrors = await updateNuOrderFlags(idStyle);
        nuOrderFlagErrors.length && errors.push(nuOrderFlagErrors);

        //3. Update the processed flags
        res?.data?.IsSuccess &&
          (await updateProessedFlag('SourceStyleImport', 'idStyle', idStyle));
      } catch (err) {
        errors.push({
          idStyle,
          err: err?.message,
        });
      }
    } else {
      try {
        //1. Update the CarryForwardFlag to No and the OriginalSeasonYear to the current seaason
        const res = await axios.post(`${url}/bo/DevelopmentStyle/${idStyle}`, {
          Entity: {
            cat33: false,
            cat24: Season,
          },
        });

        //2. Clear NuOrderApproved flag for all colors
        const nuOrderFlagErrors = await updateNuOrderFlags(idStyle);
        nuOrderFlagErrors.length && errors.push(nuOrderFlagErrors);

        res?.data?.IsSuccess &&
          (await updateProessedFlag('SourceStyleImport', 'idStyle', idStyle));
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
  updateNuOrderFlags,
};
