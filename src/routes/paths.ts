const ROOTS = {
  DASHBOARD: '/dashboard',
  EMBED: '/embed',
  API: '/api/v1',
};

// ----------------------------------------------------------------------

/** Every URL the app links or redirects to. Build hrefs from here, never by hand. */
export const paths = {
  home: '/',
  hire: 'https://www.fiverr.com/cuongnqxx',
  widgetScript: '/widget.js',
  auth: {
    login: '/login',
    signup: '/signup',
  },
  api: {
    chat: `${ROOTS.API}/chat`,
  },
  embed: {
    standalone: (botId: string) => `${ROOTS.EMBED}/${botId}?mode=standalone`,
    playground: (botId: string) => `${ROOTS.EMBED}/${botId}?mode=playground`,
  },
  dashboard: {
    root: ROOTS.DASHBOARD,
    bot: {
      root: (botId: string) => `${ROOTS.DASHBOARD}/bots/${botId}`,
      sources: (botId: string) => `${ROOTS.DASHBOARD}/bots/${botId}/sources`,
      playground: (botId: string) => `${ROOTS.DASHBOARD}/bots/${botId}/playground`,
      conversations: (botId: string) => `${ROOTS.DASHBOARD}/bots/${botId}/conversations`,
      conversation: (botId: string, conversationId: string) =>
        `${ROOTS.DASHBOARD}/bots/${botId}/conversations/${conversationId}`,
      leads: (botId: string) => `${ROOTS.DASHBOARD}/bots/${botId}/leads`,
      leadsExport: (botId: string) => `${ROOTS.DASHBOARD}/bots/${botId}/leads/export`,
      settings: (botId: string) => `${ROOTS.DASHBOARD}/bots/${botId}/settings`,
      install: (botId: string) => `${ROOTS.DASHBOARD}/bots/${botId}/install`,
    },
  },
};
