define([
  'dojo/_base/declare', 
  'jimu/BaseWidget', 
  'dijit/_WidgetsInTemplateMixin',             
  "ready",  
  "esri/geometry/Point",
  "esri/graphic",
  "esri/InfoTemplate",
  "dojo/domReady!"
],
function(declare, BaseWidget, _WidgetsInTemplateMixin,  ready, Point, Graphic, InfoTemplate) {
  
  let portalUserData, codigosMunicipio = [], accesToken, expiration;  

  const getToken = async (name, kayPass) => {
    let tokenHeaders = new Headers();
    tokenHeaders.append("Content-Type", "application/x-www-form-urlencoded");
    //myHeaders.append('Access-Control-Allow-Origin', '*')
    let urlencoded = new URLSearchParams();
    urlencoded.append("username", name.toString());
    urlencoded.append("password", kayPass.toString());
    urlencoded.append("client", "requestip");
    urlencoded.append("expiration", "60");
    urlencoded.append("f", "json");

    let requestOptions = {
      method: 'POST',
      headers: tokenHeaders,
      body: urlencoded,
      redirect: 'follow',
      mode: 'cors'
    };

    await fetch("https://planordenamiento-des.ant.gov.co/portal/sharing/rest/generateToken", requestOptions)
      .then(response => response.json())
      .then(result => {        
        accesToken = result.token;
        expiration = result.expires;        
      })
      .catch(error => console.log('error', error));
      document.getElementById('user-password').value = '';
  }

  const getUser = async (user, token) => {
    let requestOptions = {
      method: 'POST',
      redirect: 'follow'
    };

    let q = `sortOrder=asc&searchUserAccess=groupMember&searchUserName=${user}&f=json&token=${token}`;

    await fetch(`https://planordenamiento-des.ant.gov.co/portal/sharing/rest/community/groups?${q}`, requestOptions)
      .then(response =>  response.text())
      .then((result) => {           
        portalUserData = JSON.parse(result);        
      })
      .catch( error => {
        closeSession(this.map);
        console.log('error obteniendo datos del usuario', error)
      });
  }

  const getMunicipioCodes = (portalUserItems) => {
    //debugger
    portalUserItems.forEach(element => {
      try {
        let municipioData = element.title.split('_');
        let municipioName = element.tags[0];
        if(element.title.includes('BPM_CON_PNUD')) {
          let userMuniObject = {
            [municipioName] : municipioData[ municipioData.length - 1 ]
          }
          codigosMunicipio.push(userMuniObject);
        }    
      } catch (error) {
        console.log('error consultando grupo');
      }      
       
    });    
  }

  const displayUserItems = () => {
    document.getElementsByClassName('login-container')[0].style.display = 'none';
    document.getElementsByClassName('filter-data-container')[0].style.display = 'block';
    let municipioSelect =  document.getElementById('municipio-selector');
    codigosMunicipio.forEach(element => {
      municipioSelect.innerHTML += `<option value=${ Object.values(element)[0] }>${ Object.keys(element)[0] }</option>`
    });     
  }

  const getMunicipioGeometry = async (featureUrl, searchField, muniCode, queryToken) => {
    let muniGeometry;       
    let queryString = `query?where=${searchField}+like+'${muniCode}%'&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&distance=&units=esriSRUnit_Foot&relationParam=&outFields=*&returnGeometry=true&maxAllowableOffset=&geometryPrecision=&outSR=4326&havingClause=&gdbVersion=&historicMoment=&returnDistinctValues=false&returnIdsOnly=false&returnCountOnly=false&returnExtentOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&multipatchOption=xyFootprint&resultOffset=&resultRecordCount=&returnTrueCurves=false&returnExceededLimitFeatures=false&quantizationParameters=&returnCentroid=false&timeReferenceUnknownClient=false&sqlFormat=none&resultType=&featureEncoding=esriDefault&datumTransformation=&f=json&token=`
    await fetch(`${featureUrl}${queryString}${queryToken}`)         
      .then(response => response.text())
      .then(result => {            
        muniGeometry = JSON.parse(result); 
      })
      .catch(error => {
        console.log('error consultando municipio', error);
        console.log(this)
        closeSession(this.map);
      });    
     return muniGeometry;
  }

  const getFeatureLayerToken = async(previousToken) => {
    let requestNewTokenOptions = {
      method: 'GET',
      redirect: 'follow'
    };
    let referer = `${window.location.hostname}`;    
    let grantedToken;        
    await fetch(`https://planordenamiento-des.ant.gov.co/portal/sharing/generateToken?request=getToken&serverUrl=https://planordenamiento-des.ant.gov.co/arcgis/rest/services/FRM_UNIFICADOS/FORM_Unificado/FeatureServer/3/query&token=${previousToken}&referer=${referer}&f=json`, requestNewTokenOptions)
      .then(response => response.text())
      .then(result => {
        grantedToken = JSON.parse(result).token;
      })
      .catch(error => console.log('error', error));          
    return grantedToken;
  }

  const closeSession = (map) => {
    portalUserData = undefined;
    codigosMunicipio = [];
    accesToken = undefined;
    expiration = undefined;    
    document.getElementsByClassName('login-container')[0].style.display = 'flex';
    document.getElementsByClassName('filter-data-container')[0].style.display = 'none';
    let centerPoint = new Point(-73.5, 4.57);
    map.graphics.clear();
    map.centerAndZoom(centerPoint, 6);
    document.getElementById('municipio-selector').innerHTML= '';
  }

  const sessionInterval = () => {    
    expiration ? Date.now() > expiration ? closeSession() : null : null;
  }

  return declare([BaseWidget], {
    startup: function(flag) { 
      ready(function () {    
        const form  = document.getElementById('login-form');
        let userName = form.elements['user-name'];
        let userPassword = form.elements['user-password'];        
        form.addEventListener('submit', async function (event) {
          event.preventDefault();     
          if (userName.value && userPassword.value) {
            await getToken(userName.value, userPassword.value);
            accesToken ? await getUser(userName.value, accesToken) : alert('credenciales incorrectas');
            if (portalUserData && portalUserData.results) {
              getMunicipioCodes(portalUserData.results);
              codigosMunicipio.length ? displayUserItems() : null;
            } else {
              console.log('error consultando el usuario', portalUserData);
            }
          } else {
            alert('Debes ingresar usuario y contraseña, !Revisa tus credenciales¡');
          }
        });        
      });
      console.log('startup');
    },
    onOpen: function() {
         
      let searchMuniButton = document.getElementById('search-muni-button');
      let selectMunicipio = document.getElementById('municipio-selector');     
      let closeSessionButton = document.getElementsByClassName('btn-three')[0];
      let selectForm = document.getElementById('form-selector');

      closeSessionButton.addEventListener("click", (e) => {
        e.preventDefault();        
        closeSession(this.map);
      });

      searchMuniButton.addEventListener("click", async (e) => {        
        try {
          let muniPoints;
          let featureServerToken = await getFeatureLayerToken(accesToken);              
          featureServerToken ? muniPoints = await getMunicipioGeometry(this.config.servicesURLs[selectForm.value].url, this.config.servicesURLs[selectForm.value].searchField, selectMunicipio.value, featureServerToken): null
          if(muniPoints.features) {
            this.map.graphics.clear();
            console.log('muniPoints', muniPoints);  
            muniPoints.features.forEach((element) => {             
              let infoTemplate = new InfoTemplate();              
              let attributesPairs = Object.entries(element.attributes);
              let finalTemplate = `<table class="default">`;              
              attributesPairs.map((element ) => {
                let namePerAlias;
                muniPoints.fields.map((field) => {
                  field.name == element[0] ? namePerAlias = field.alias : null;
                });            
                finalTemplate += `<tr>
                                    <td  style='width:60px; text-align:center;'><b>${namePerAlias} </b></td>
                                    <td style='width:20px; text-align:left;'>${element[1]}</td>
                                  </tr>`
              });
              finalTemplate += `</table>`;
              infoTemplate.setContent(finalTemplate);
              infoTemplate.setTitle('Atributos')
              let myPoint = {
                "geometry": element.geometry,
                "attributes": element.attributes,
                "symbol": {
                  "color":[255, 0, 0, 128],
                  "size": 6, "angle": 0, "xoffset": 0, "yoffset": 0, "type": "esriSMS",
                  "style": "esriSMSSquare", 
                  "outline": {
                    "color": [0, 0, 0, 255], "width": 1,
                    "type": "esriSLS", "style": "esriSLSSolid"
                  }
                },
                "infoTemplate": infoTemplate
              };             
              let gra = new Graphic(myPoint);  
              this.map.graphics.add(gra);    
            });
          }     
          this.map.graphics.refresh();
          let popUpContent = document.getElementsByClassName('esriPopupWrapper');
          console.log(popUpContent);
          this.map.centerAndZoom(this.map.graphics.graphics[0].geometry, 10);                    
        } catch (error) {
          console.log('error obteniendo la geometria' ,error);
        }
      });
      setInterval(function () {
        sessionInterval();
      }, 60000);      
    },
    postCreate: function(flag) {
      console.log('post create');     
    },
  });
});