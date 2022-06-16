const axios = require('axios');
const { url } = require('./config.js');

const getAndromedaData = async (query, start) => {
  // //Custom query example
  // res = await axios.post(`${url}/search/query/${query}`, {
  //   getafterdate: start,
  // });

  // Get all Development Styles from Andromeda
  const res = await axios.get(`${url}/bo/${query}`);

  // Create an array of only the relevant data for each Development Style
  const sourceStyleData = res.data.map(
    ({ id_developmentstyle, season, style, sourcestyle, cat33, createdon }) => {
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
        CarryForward: cat33,
        CreatedOn: createdon,
        AndromedaProcessed: 'No',
        AndromedaProcessedTime: '',
      };
    }
  );

  /*
	Return only styles where...
			1. The style number of the source style does not match the style number of the development style
			2. The CarryForward flag is set to true.
	These are the ones where the CarryForward flag needs to be updated
 */
  return sourceStyleData.filter(
    ({ SourceStyle, Style, CarryForward }) =>
      SourceStyle !== '' && SourceStyle !== Style && CarryForward
  );
};

module.exports = {
  getAndromedaData,
};
