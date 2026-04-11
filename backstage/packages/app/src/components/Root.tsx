import React, { PropsWithChildren } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import HomeIcon from '@material-ui/icons/Home';
import ExtensionIcon from '@material-ui/icons/Extension';
import LibraryBooks from '@material-ui/icons/LibraryBooks';
import CreateComponentIcon from '@material-ui/icons/AddCircleOutline';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarPage,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import { SidebarSearchModal } from '@backstage/plugin-search';
import {
  Settings as SidebarSettings,
  UserSettingsSignInAvatar,
} from '@backstage/plugin-user-settings';

const useSidebarLogoStyles = makeStyles({
  root: {
    width: '100%',
    height: 3 * 8,
    display: 'flex',
    flexFlow: 'row nowrap',
    alignItems: 'center',
    padding: '24px 0 24px 24px',
  },
  logoText: {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '1.1rem',
    letterSpacing: '0.05em',
    textDecoration: 'none',
  },
});

const SidebarLogo = () => {
  const classes = useSidebarLogoStyles();
  return (
    <div className={classes.root}>
      <NavLink to="/" className={classes.logoText}>
        IDP
      </NavLink>
    </div>
  );
};

export const Root = ({ children }: PropsWithChildren<{}>) => (
  <SidebarPage>
    <Sidebar>
      <SidebarLogo />
      <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
        <SidebarSearchModal />
      </SidebarGroup>
      <SidebarDivider />
      <SidebarGroup label="Menu" icon={<MenuIcon />}>
        <SidebarItem icon={HomeIcon} to="home" text="Home" />
        <SidebarItem icon={ExtensionIcon} to="catalog" text="Catalog" />
        <SidebarItem icon={CreateComponentIcon} to="create" text="Create" />
        <SidebarItem icon={LibraryBooks} to="docs" text="Docs" />
        <SidebarItem icon={AccountTreeIcon} to="catalog-graph" text="Graph" />
      </SidebarGroup>
      <SidebarSpace />
      <SidebarScrollWrapper>
        <SidebarDivider />
        <SidebarGroup
          label="Settings"
          icon={<UserSettingsSignInAvatar />}
          to="/settings"
        >
          <SidebarSettings />
        </SidebarGroup>
      </SidebarScrollWrapper>
    </Sidebar>
    {children}
  </SidebarPage>
);
