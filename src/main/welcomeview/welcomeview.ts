// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { BrowserView, ipcMain, shell } from 'electron';
import { DarkThemeBGColor, getUserHomeDir, LightThemeBGColor } from '../utils';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';
import { XMLParser } from 'fast-xml-parser';
import { appData, SettingType, userSettings } from '../settings';

interface INewsItem {
  title: string;
  link: string;
}

const notebookIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" viewBox="0 0 22 22">
<g class="jp-icon-warn0 jp-icon-selectable" fill="#EF6C00">
  <path d="M18.7 3.3v15.4H3.3V3.3h15.4m1.5-1.5H1.8v18.3h18.3l.1-18.3z"/>
  <path d="M16.5 16.5l-5.4-4.3-5.6 4.3v-11h11z"/>
</g>
</svg>`;
const labIcon = fs.readFileSync(
  path.join(__dirname, '../../../app-assets/icon.svg')
);
const openIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M88.7 223.8L0 375.8V96C0 60.7 28.7 32 64 32H181.5c17 0 33.3 6.7 45.3 18.7l26.5 26.5c12 12 28.3 18.7 45.3 18.7H416c35.3 0 64 28.7 64 64v32H144c-22.8 0-43.8 12.1-55.3 31.8zm27.6 16.1C122.1 230 132.6 224 144 224H544c11.5 0 22 6.1 27.7 16.1s5.7 22.2-.1 32.1l-112 192C453.9 474 443.4 480 432 480H32c-11.5 0-22-6.1-27.7-16.1s-5.7-22.2 .1-32.1l112-192z"/></svg>
`;
const serverIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M64 32C28.7 32 0 60.7 0 96v64c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zM344 152c-13.3 0-24-10.7-24-24s10.7-24 24-24s24 10.7 24 24s-10.7 24-24 24zm96-24c0 13.3-10.7 24-24 24s-24-10.7-24-24s10.7-24 24-24s24 10.7 24 24zM64 288c-35.3 0-64 28.7-64 64v64c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V352c0-35.3-28.7-64-64-64H64zM344 408c-13.3 0-24-10.7-24-24s10.7-24 24-24s24 10.7 24 24s-10.7 24-24 24zm104-24c0 13.3-10.7 24-24 24s-24-10.7-24-24s10.7-24 24-24s24 10.7 24 24z"/></svg>`;
const externalLinkIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M352 0c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9L370.7 96 201.4 265.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L416 141.3l41.4 41.4c9.2 9.2 22.9 11.9 34.9 6.9s19.8-16.6 19.8-29.6V32c0-17.7-14.3-32-32-32H352zM80 32C35.8 32 0 67.8 0 112V432c0 44.2 35.8 80 80 80H400c44.2 0 80-35.8 80-80V320c0-17.7-14.3-32-32-32s-32 14.3-32 32V432c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V112c0-8.8 7.2-16 16-16H192c17.7 0 32-14.3 32-32s-14.3-32-32-32H80z"/></svg>`;

export class WelcomeView {
  constructor(options: WelcomeView.IOptions) {
    this._isDarkTheme = options.isDarkTheme;
    this._view = new BrowserView({
      webPreferences: {
        preload: path.join(__dirname, './preload.js'),
        devTools: process.env.NODE_ENV === 'development'
      }
    });

    this._view.setBackgroundColor(
      this._isDarkTheme ? DarkThemeBGColor : LightThemeBGColor
    );

    const jupyterlabWordmarkSrc = fs.readFileSync(
      path.join(__dirname, '../../../app-assets/jupyterlab-wordmark.svg')
    );

    const home = getUserHomeDir();
    const showNewsFeed = userSettings.getValue(SettingType.showNewsFeed);
    let recentSessionCount = 0;
    let recentSessionSection = '';

    for (const recentSession of appData.recentSessions) {
      let sessionItem = '';
      let sessionDetail = '';
      let tooltip = '';
      let parent = '';
      if (recentSession.remoteURL) {
        const url = new URL(recentSession.remoteURL);
        sessionItem = url.origin;
        tooltip = `${recentSession.remoteURL}\nSession data ${
          recentSession.persistSessionData ? '' : 'not '
        }persisted`;
        sessionDetail = 'remote';
      } else {
        // local
        if (recentSession.filesToOpen.length > 0) {
          sessionItem = path.basename(recentSession.filesToOpen[0]);
          tooltip = recentSession.filesToOpen[0];
          parent = recentSession.workingDirectory;
        } else {
          sessionItem = path.basename(recentSession.workingDirectory);
          parent = path.dirname(recentSession.workingDirectory);
          tooltip = recentSession.workingDirectory;
        }

        if (parent.startsWith(home)) {
          const relative = path.relative(home, parent);
          sessionDetail = `~${path.sep}${relative}`;
        } else {
          sessionDetail = parent;
        }
      }

      recentSessionSection += `<div class="row">
          <a href="javascript:void(0)" onclick='handleRecentSessionClick(${recentSessionCount});' title="${tooltip}">${sessionItem}</a><span class="recent-session-detail" title="${sessionDetail}">${sessionDetail}</span>
        </div>`;

      recentSessionCount++;
      if (recentSessionCount === 5) {
        break;
      }
    }

    if (recentSessionSection === '') {
      recentSessionSection =
        '<div class="no-recent-message">No history yet</div>';
    }

    this._pageSource = `
      <!DOCTYPE html>
      <!--
      Copyright (c) Jupyter Development Team.
      Distributed under the terms of the Modified BSD License.
      
      // control box SVGs from https://github.com/AlexTorresSk/custom-electron-titlebar
      -->
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0">
          <title>JupyterLab Header</title>
          <style>
            body {
              background: ${LightThemeBGColor};
              color: #000000;
              margin: 0;
              overflow: hidden;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica,
                Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
                'Segoe UI Symbol';
              font-size: 13px;
              -webkit-user-select: none;
              user-select: none;
            }
            body.app-ui-dark {
              background: ${DarkThemeBGColor};
              color: #ffffff;
            }
            .container {
              padding: 80px 120px;
              font-size: 16px;
            }
            .row {
              display: flex;
              flex-direction: row;
              font-size: 14px;
              line-height: 18px;
            }
            .col {
              display: flex;
              flex-direction: column;
            }
            .logo svg {
              width: 80px;
              height: 80px;
            }
            .app-title-row {
              align-items: center;
              column-gap: 10px;
              margin-bottom: 80px;
            }
            .app-title {
              font-size: 30px;
            }
            .start-recent-col {
              width: 40%;
              flex-basis: 40%;
              flex-grow: 1;
              row-gap: 40px;
            }
            .news-list-hidden .start-recent-col {
              width: 60%;
              flex-basis: 60%;
            }
            .start-col {
              row-gap: 2px;
            }
            .recent-col {
              row-gap: 5px;
            }
            .news-col {
              width: 40%;
              flex-basis: 40%;
              flex-grow: 1;
              row-gap: 5px;
              padding-left: 10px;
            }
            .news-list-hidden .news-col {
              width: 20%;
              flex-basis: 20%;
            }
            .news-list-col {
              display: flex;
              flex-direction: column;
              row-gap: 5px;
            }
            .news-col-footer {
              margin-top: 5px;
            }
            .row-title {
              font-weight: bold;
              margin-bottom: 5px;
              font-size: 16px;
            }
            a {
              color: #555555;
              text-decoration: none;
            }
            a:hover {
              color: #777777;
            }
            .app-ui-dark a {
              color: #cccccc;
            }
            .app-ui-dark a:hover {
              color: #eeeeee;
            }
            .more-row a {
              color: #202020;
            }
            .app-ui-dark .more-row a {
              color: #f0f0f0;
            }
            .jupyterlab-wordmark svg {
              width: 300px;
            }
            .jupyterlab-wordmark .jp-icon2 {
              fill: #888888;
            }
            .recent-session-detail {
              padding-left: 10px;
            }
            .recent-session-detail, .news-list-col .row a {
              text-overflow: ellipsis;
              overflow: hidden;
              white-space: nowrap;
            }
            .no-recent-message {
              color: #777777;
            }
            .app-ui-dark .no-recent-message {
              color: #999999;
            }
            .action-row a {
              display: flex;
              flex-direction: row;
              align-items: center;
            }
            .action-row span {
              margin-right: 8px;
              padding-top: 4px;
              width: 26px;
              height: 26px;
            }
            .action-row svg {
              width: 22px;
              height: 22px;
              fill: #555555;
            }
            .app-ui-dark .action-row svg {
              fill: #dddddd;
            }
            .new-notebook-action-row svg {
              width: 25px;
              height: 25px;
              margin-left: -1px;
            }
            .new-session-action-row svg {
              width: 26px;
              height: 26px;
              margin-left: -2px;
            }
          </style>
          <script>
            document.addEventListener("DOMContentLoaded", () => {
              const platform = "${process.platform}";
              document.body.dataset.appPlatform = platform;
              document.body.classList.add('app-ui-' + platform);
            });
          </script>
        </head>
      
        <body class="${this._isDarkTheme ? 'app-ui-dark' : ''} ${
      showNewsFeed ? '' : 'news-list-hidden'
    }">
          <div class="body-container">
          <div class="container">
            <div class="row app-title-row">
              <div class="app-title">
                <div class="jupyterlab-wordmark">
                  ${jupyterlabWordmarkSrc}
                </div>
              </div>
            </div>

            <div class="row content-row">
              <div class="col start-recent-col">
                <div class="col start-col">
                  <div class="row row-title">
                    Start
                  </div>
                  <div class="row action-row new-notebook-action-row">
                    <a href="javascript:void(0)" title="Create new notebook in the default working directory" onclick="handleNewSessionClick('notebook');">
                      <span class="action-icon">${notebookIcon}</span>
                      New notebook...
                    </a>
                  </div>
                  <div class="row action-row new-session-action-row">
                    <a href="javascript:void(0)" title="Launch new JupyterLab session in the default working directory" onclick="handleNewSessionClick('blank');">
                      <span class="action-icon">${labIcon}</span>
                      New session...
                    </a>
                  </div>
                  ${
                    process.platform === 'darwin'
                      ? `<div class="row action-row">
                      <a href="javascript:void(0)" title="Open a notebook or folder in JupyterLab" onclick="handleNewSessionClick('open');">
                        <span class="action-icon">${openIcon}</span>
                        Open...
                      </a>
                    </div>`
                      : `<div class="row action-row">
                      <a href="javascript:void(0)" title="Open a notebook or file in JupyterLab" onclick="handleNewSessionClick('open-file');">
                        <span class="action-icon">${openIcon}</span>
                        Open File...
                      </a>
                    </div>
                    <div class="row action-row">
                      <a href="javascript:void(0)" title="Open a folder in JupyterLab" onclick="handleNewSessionClick('open-folder');">
                        <span class="action-icon">${openIcon}</span>
                        Open Folder...
                      </a>
                    </div>`
                  }
                  <div class="row action-row">
                    <a href="javascript:void(0)" title="Connect to an existing local or remote JupyterLab server" onclick="handleNewSessionClick('remote');">
                      <span class="action-icon">  
                      ${serverIcon}
                      </span>
                      Connect...
                    </a>
                  </div>
                </div>
                
                <div class="col recent-col">
                  <div class="row row-title">
                    Recent sessions
                  </div>
                  ${recentSessionSection}
                </div>
              </div>

              <div class="col news-col">
                <div class="row row-title">
                  Jupyter News
                </div>

                <div id="news-list" class="news-list-col">
                ${
                  // populate news list from cache
                  WelcomeView._newsList
                    .map((news: INewsItem) => {
                      return `<div class="row">
                        <a href="javascript:void(0)" onclick=\'handleNewsClick("${news.link}");\' title="${news.title}">${news.title}</a>
                      </div>`;
                    })
                    .join('')
                }
                </div>

                <div class="row action-row more-row news-col-footer">
                  <a href="javascript:void(0)" onclick='handleNewsClick("https://blog.jupyter.org");'>
                    <span class="action-icon">${externalLinkIcon}</span>
                    Jupyter Blog
                  </a>
                </div>
              </div>
            </div>
          </div>
          </div>

          <script>
          const newsListContainer = document.getElementById('news-list');
          
          window.electronAPI.onSetNewsList((newsList) => {
            // clear list
            while (newsListContainer.firstChild) {
              newsListContainer.firstChild.remove();
            }

            const fragment = new DocumentFragment();
            for (const news of newsList) {
              const newsRow = document.createElement('div');
              newsRow.innerHTML = \`
                <div class="row">
                  <a href="javascript:void(0)" onclick=\'handleNewsClick("\$\{news.link\}");\' title="\$\{news.title\}">\$\{news.title\}</a>
                </div>\`;
              fragment.append(newsRow);
            }

            newsListContainer.append(fragment);
          });

          document.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.stopPropagation();
          });
          
          document.addEventListener('drop', (event) => {
            event.preventDefault();
            event.stopPropagation();
        
            const files = [];
            for (const file of event.dataTransfer.files) {
              files.push(file.path);
            }

            window.electronAPI.openDroppedFiles(files);
          });

          function handleNewSessionClick(type) {
            window.electronAPI.newSession(type);
          }

          function handleRecentSessionClick(sessionIndex) {
            window.electronAPI.openRecentSession(sessionIndex);
          }

          function handleNewsClick(newsLink) {
            window.electronAPI.openNewsLink(newsLink);
          }
          </script>
        </body>
      </html>
      `;

    this._registerListeners();
  }

  get view(): BrowserView {
    return this._view;
  }

  load() {
    this._view.webContents.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(this._pageSource)}`
    );

    if (userSettings.getValue(SettingType.showNewsFeed)) {
      this._updateNewsList();
    }
  }

  private _registerListeners() {
    ipcMain.on('open-news-link', (event, link) => {
      if (event.sender !== this._view.webContents) {
        return;
      }

      try {
        const url = new URL(decodeURIComponent(link));
        if (url.protocol === 'https:' || url.protocol === 'http:') {
          shell.openExternal(url.href);
        }
      } catch (error) {
        console.error('Invalid news URL');
      }
    });
  }

  private _updateNewsList() {
    const newsFeedUrl = 'https://blog.jupyter.org/feed';
    const maxNewsToShow = 10;

    fetch(newsFeedUrl)
      .then(async response => {
        try {
          const data = await response.text();
          const parser = new XMLParser();
          const feed = parser.parse(data);
          const newsList: INewsItem[] = [];
          for (const item of feed.rss.channel.item) {
            newsList.push({
              title: item.title,
              link: encodeURIComponent(item.link)
            });
            if (newsList.length === maxNewsToShow) {
              break;
            }
          }

          this._view.webContents.send('set-news-list', newsList);

          WelcomeView._newsList = newsList;
        } catch (error) {
          console.error('Failed to parse news list:', error);
        }
      })
      .catch(error => {
        console.error('Failed to fetch news list:', error);
      });
  }

  private _isDarkTheme: boolean;
  private _view: BrowserView;
  private _pageSource: string;
  static _newsList: INewsItem[] = [];
}

export namespace WelcomeView {
  export interface IOptions {
    isDarkTheme: boolean;
  }
}
