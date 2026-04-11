import React from 'react';
import { makeStyles, Theme } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Paper from '@material-ui/core/Paper';
import ExtensionIcon from '@material-ui/icons/Extension';
import LibraryBooks from '@material-ui/icons/LibraryBooks';
import {
  SearchBar,
  SearchFilter,
  SearchResult,
  SearchType,
  DefaultResultListItem,
} from '@backstage/plugin-search';
import { CatalogSearchResultListItem } from '@backstage/plugin-catalog';
import { TechDocsSearchResultListItem } from '@backstage/plugin-techdocs';

const useStyles = makeStyles((theme: Theme) => ({
  bar: {
    padding: theme.spacing(1, 0),
  },
  filters: {
    background: theme.palette.background.paper,
    padding: theme.spacing(2),
    marginTop: theme.spacing(1),
  },
  results: {
    marginTop: theme.spacing(2),
  },
}));

export const searchPage = (
  <Grid container direction="row">
    <Grid item xs={12}>
      <SearchBar />
    </Grid>
    <Grid item xs={12} sm={3}>
      <Paper>
        <SearchType.Accordion
          name="Result Type"
          defaultValue="software-catalog"
          types={[
            {
              value: 'software-catalog',
              name: 'Software Catalog',
              icon: <ExtensionIcon />,
            },
            {
              value: 'techdocs',
              name: 'Documentation',
              icon: <LibraryBooks />,
            },
          ]}
        />
        <SearchFilter.Select
          label="Kind"
          name="kind"
          values={['Component', 'API', 'System', 'Group', 'User', 'Template']}
        />
        <SearchFilter.Select
          label="Lifecycle"
          name="lifecycle"
          values={['production', 'experimental', 'deprecated']}
        />
      </Paper>
    </Grid>
    <Grid item xs={12} sm={9}>
      <SearchResult>
        <CatalogSearchResultListItem />
        <TechDocsSearchResultListItem />
        <DefaultResultListItem />
      </SearchResult>
    </Grid>
  </Grid>
);

// Dummy export to suppress the makeStyles tree-shaking warning
export { useStyles as _searchPageStyles };
