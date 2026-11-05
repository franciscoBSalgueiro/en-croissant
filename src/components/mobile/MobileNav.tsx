import {
  type Icon,
  IconChess,
  IconCpu,
  IconDatabase,
  IconFiles,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import cx from "clsx";
import { useTranslation } from "react-i18next";
import classes from "./MobileNav.module.css";

const items: { icon: Icon; label: string; url: string }[] = [
  { icon: IconChess, label: "Board", url: "/" },
  { icon: IconUser, label: "User", url: "/accounts" },
  { icon: IconFiles, label: "Files", url: "/files" },
  { icon: IconDatabase, label: "Databases", url: "/databases" },
  { icon: IconCpu, label: "Engines", url: "/engines" },
  { icon: IconSettings, label: "Settings", url: "/settings" },
];

export const MOBILE_NAV_HEIGHT = 56;

/** Bottom tab bar used instead of the left sidebar on phones/tablets. */
export function MobileNav() {
  const { t } = useTranslation();
  const match = useMatchRoute();
  return (
    <nav className={classes.nav}>
      {items.map(({ icon: Icon, label, url }) => {
        const active =
          url === "/" ? match({ to: "/" }) !== false : match({ to: url, fuzzy: true }) !== false;
        return (
          <Link key={url} to={url} className={cx(classes.item, { [classes.active]: active })}>
            <Icon size={24} stroke={active ? 2 : 1.6} />
            <span>{t(`SideBar.${label}`)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
