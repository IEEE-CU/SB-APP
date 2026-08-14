/**
 * Service to handle Google Drive API interactions for SB-APP.
 */

const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

export const initGoogleCloud = (clientId: string, onReady: () => void) => {
  const gapi = (window as any).gapi;
  const google = (window as any).google;

  if (!gapi || !google || !clientId) return;

  gapi.load('client', async () => {
    await gapi.client.init({
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited = true;
    checkReady();
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: '',
  });
  gisInited = true;
  checkReady();

  function checkReady() {
    if (gapiInited && gisInited) onReady();
  }
};

export const connectCloudAccount = (clientId: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      const google = (window as any).google;
      if (google) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: '',
        });
      } else {
        reject("Google Identity Services not loaded");
        return;
      }
    }

    tokenClient.callback = async (resp: any) => {
      if (resp.error !== undefined) {
        reject(resp);
      }
      resolve(resp);
    };

    if ((window as any).gapi?.client?.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
};

export const syncLedgerToCloud = async (stateData: any): Promise<string> => {
  const gapi = (window as any).gapi;
  if (!gapi?.client?.drive) throw new Error("GAPI not initialized");

  const fileName = 'ieee_sb_app_ledger.json';
  const fileContent = JSON.stringify(stateData);
  const fileBoundary = 'foo_bar_baz';

  const response = await gapi.client.drive.files.list({
    q: `name = '${fileName}' and trashed = false`,
    fields: 'files(id, name)',
  });

  const existingFile = response.result.files[0];

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
  };

  if (existingFile) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${gapi.client.getToken().access_token}`,
        'Content-Type': 'application/json',
      },
      body: fileContent,
    });
    return new Date().toISOString();
  } else {
    const body = 
      `--${fileBoundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${fileBoundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${fileBoundary}--`;

    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gapi.client.getToken().access_token}`,
        'Content-Type': `multipart/related; boundary=${fileBoundary}`,
      },
      body: body,
    });
    return new Date().toISOString();
  }
};
