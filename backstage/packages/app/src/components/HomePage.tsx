import React from 'react';
import Grid from '@material-ui/core/Grid';
import {
  HomePageStarredEntities,
  HomePageRecentlyVisited,
  WelcomeTitle,
  HeaderWorldClock,
  HomePageSearchBar,
  ClockConfig,
} from '@backstage/plugin-home';
import { Content, Header, Page } from '@backstage/core-components';
import { SearchContextProvider } from '@backstage/plugin-search-react';

const clockConfigs: ClockConfig[] = [
  { label: 'UTC', timeZone: 'UTC' },
  { label: 'NYC', timeZone: 'America/New_York' },
  { label: 'LON', timeZone: 'Europe/London' },
  { label: 'SGP', timeZone: 'Asia/Singapore' },
];

export const HomePage = () => (
  <SearchContextProvider>
    <Page themeId="home">
      <Header title={<WelcomeTitle />} pageTitleOverride="Home">
        <HeaderWorldClock clockConfigs={clockConfigs} />
      </Header>
      <Content>
        <Grid container spacing={3} alignItems="stretch">
          <Grid item xs={12}>
            <HomePageSearchBar
              placeholder="Search the catalog, docs, and APIs…"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <HomePageStarredEntities />
          </Grid>
          <Grid item xs={12} md={6}>
            <HomePageRecentlyVisited />
          </Grid>
        </Grid>
      </Content>
    </Page>
  </SearchContextProvider>
);
