const axios = require('axios');
const { url } = require('./config.js');

const getAndromedaData = async (query, start) => {
  // //Custom query example
  // res = await axios.post(`${url}/search/query/${query}`, {
  //   getafterdate: start,
  // });

  // Get all development styles from Andromeda
  const res = await axios.get(`${url}/bo/${query}`);

  // Create an array of only the relevant data for each development style
  const sourceStyleData = res.data.map(
    ({ id_developmentstyle, season, style, sourcestyle, cat33, createdon }) => {
      let SourceSeason = '';
      let SourceStyle = '';

      if (sourcestyle) {
        const sourceArr = sourcestyle.split(' ');
        SourceStyle = sourceArr[0];
        SourceSeason = sourceArr[1];
      }

      console.log(cat33);
      return {
        idStyle: id_developmentstyle,
        Season: season,
        Style: style,
        SourceSeason,
        SourceStyle,
        CarryForward: cat33 === true ? 'Yes' : 'No',
        CreatedOn: createdon.substring(0, 19),
        AndromedaProcessed: 'No',
        AndromedaProcessedTime: '',
      };
    }
  );

  /*
	Return only styles where...
			1. The source style is not blank
			2. The source style does not match the style number of the development style
			3. The carry forward flag is set to true
	These are the ones where the carry forward flag needs to be updated
 */
  return sourceStyleData.filter(
    ({ SourceStyle, Style, CarryForward }) =>
      SourceStyle !== '' && SourceStyle !== Style && CarryForward
  );
};

module.exports = {
  getAndromedaData,
};
