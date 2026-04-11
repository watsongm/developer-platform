import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { apiDocsPlugin, ApiExplorerPage } from '@backstage/plugin-api-docs';
import {
  CatalogEntityPage,
  CatalogIndexPage,
  catalogPlugin,
} from '@backstage/plugin-catalog';
import {
  CatalogImportPage,
  catalogImportPlugin,
} from '@backstage/plugin-catalog-import';
import { CatalogGraphPage } from '@backstage/plugin-catalog-graph';
import { orgPlugin } from '@backstage/plugin-org';
import { SearchPage } from '@backstage/plugin-search';
import {
  TechDocsIndexPage,
  TechDocsReaderPage,
  techdocsPlugin,
} from '@backstage/plugin-techdocs';
import { TechDocsAddons } from '@backstage/plugin-techdocs-react';
import { ReportIssue } from '@backstage/plugin-techdocs-module-addons-contrib';
import { UserSettingsPage } from '@backstage/plugin-user-settings';
import { ScaffolderPage, scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { createApp } from '@backstage/app-defaults';
import { AppRouter, FlatRoutes } from '@backstage/core-app-api';
import {
  CatalogImportPermission,
} from '@backstage/plugin-catalog-common/alpha';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { HomepageCompositionRoot } from '@backstage/plugin-home';

import { Root } from './components/Root';
import { HomePage } from './components/HomePage';
import { entityPage } from './components/catalog/EntityPage';
import { searchPage } from './components/search/SearchPage';
import { idpTheme } from './theme/idpTheme';

const app = createApp({
  themes: [
    {
      id: 'idp-theme',
      title: 'IDP Theme',
      variant: 'light',
      Provider: idpTheme,
    },
  ],
  bindRoutes({ bind }) {
    bind(catalogPlugin.externalRoutes, {
      createComponent: scaffolderPlugin.routes.root,
      viewTechDoc: techdocsPlugin.routes.docRoot,
      createFromTemplate: scaffolderPlugin.routes.selectedTemplate,
    });
    bind(apiDocsPlugin.externalRoutes, {
      registerApi: catalogImportPlugin.routes.importPage,
    });
    bind(orgPlugin.externalRoutes, {
      catalogIndex: catalogPlugin.routes.catalogIndex,
    });
  },
});

export default app.createRoot(
  <>
    <AppRouter>
      <Root>
        <FlatRoutes>
          <Route path="/" element={<Navigate to="home" />} />
          <Route path="/home" element={<HomepageCompositionRoot />}>
            <HomePage />
          </Route>
          <Route path="/catalog" element={<CatalogIndexPage />} />
          <Route
            path="/catalog/:namespace/:kind/:name"
            element={<CatalogEntityPage />}
          >
            {entityPage}
          </Route>
          <Route path="/docs" element={<TechDocsIndexPage />} />
          <Route
            path="/docs/:namespace/:kind/:name/*"
            element={<TechDocsReaderPage />}
          >
            <TechDocsAddons>
              <ReportIssue />
            </TechDocsAddons>
          </Route>
          <Route path="/create" element={<ScaffolderPage />} />
          <Route path="/api-docs" element={<ApiExplorerPage />} />
          <Route
            path="/catalog-import"
            element={
              <RequirePermission
                permission={CatalogImportPermission}
                errorPage={<>Access denied — team-lead or platform-admin required.</>}
              >
                <CatalogImportPage />
              </RequirePermission>
            }
          />
          <Route path="/search" element={<SearchPage />}>
            {searchPage}
          </Route>
          <Route path="/settings" element={<UserSettingsPage />} />
          <Route path="/catalog-graph" element={<CatalogGraphPage />} />
        </FlatRoutes>
      </Root>
    </AppRouter>
  </>,
);
