import {
  createUnifiedTheme,
  genPageTheme,
  palettes,
  shapes,
} from '@backstage/theme';

export const idpTheme = createUnifiedTheme({
  palette: {
    ...palettes.light,
    primary: {
      main: '#1F5C96',
    },
    secondary: {
      main: '#FF6B35',
    },
    navigation: {
      background: '#1F3A5F',
      indicator: '#FF6B35',
      color: '#d5d6db',
      selectedColor: '#ffffff',
      navItem: {
        hoverBackground: 'rgba(255,255,255,0.1)',
      },
    },
  },
  defaultPageTheme: 'home',
  pageTheme: {
    home: genPageTheme({ colors: ['#1F5C96', '#1F3A5F'], shape: shapes.wave }),
    documentation: genPageTheme({
      colors: ['#33C3F0', '#1F5C96'],
      shape: shapes.wave2,
    }),
    tool: genPageTheme({
      colors: ['#FF6B35', '#C24B16'],
      shape: shapes.round,
    }),
    service: genPageTheme({
      colors: ['#1F5C96', '#152D4D'],
      shape: shapes.wave,
    }),
    website: genPageTheme({
      colors: ['#1F5C96', '#152D4D'],
      shape: shapes.wave,
    }),
    library: genPageTheme({
      colors: ['#7DC66B', '#4E8A3B'],
      shape: shapes.wave2,
    }),
    other: genPageTheme({
      colors: ['#999999', '#666666'],
      shape: shapes.wave,
    }),
    app: genPageTheme({ colors: ['#1F5C96', '#1F3A5F'], shape: shapes.wave }),
    apis: genPageTheme({
      colors: ['#FF6B35', '#C24B16'],
      shape: shapes.round,
    }),
  },
});
