import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { logout } from "../features/auth/authSlice";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import logo from "../assets/Rosneft_logo.svg";
import "./Navbar.css";

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    dispatch(logout());
    navigate("/login");
  };

  const handleMenuClick = () => {
    // TODO: Add menu functionality
    console.log("Menu clicked");
  };

  const handleSettingsClick = () => {
    // TODO: Add settings functionality
    console.log("Settings clicked");
  };

  const handleChatClick = () => {
    // TODO: Add chat functionality
    console.log("Chat clicked");
  };

  const handleProfileClick = () => {
    // Open user profile menu (same as clicking on avatar)
    handleClick({
      currentTarget: document.querySelector(".navbar-user-info"),
    } as React.MouseEvent<HTMLElement>);
  };

  return (
    <AppBar position="static" className="navbar-appbar">
      <Toolbar>
        <Typography
          variant="h4"
          component="div"
          className="navbar-title"
          onClick={() => navigate("/marketplace")}
        >
          <div className="logo-round" style={{ width: "60px", height: "60px" }}>
            <img src={logo} alt="Rosneft Logo" className="logo-icon" />
          </div>
          Роснефть
        </Typography>
        {user && (
          <>
            
            <Box className="navbar-icons-box">
            <IconButton
                className="navbar-icon-button"
                onClick={handleMenuClick}
                aria-label="menu"
              >
                <MenuIcon className="navbar-icon" />
              </IconButton>
              <IconButton
                className="navbar-icon-button"
                onClick={handleChatClick}
                aria-label="chat"
              >
                <ChatBubbleOutlineIcon className="navbar-icon" />
              </IconButton>
              <IconButton
                className="navbar-icon-button"
                onClick={handleSettingsClick}
                aria-label="settings"
              >
                <SettingsIcon className="navbar-icon" />
              </IconButton>
            </Box>
            <Box className="navbar-user-box">
              <Box className="navbar-user-info" onClick={handleClick}>
                <IconButton
                  className="navbar-icon-button"
                  onClick={handleProfileClick}
                  aria-label="profile"
                >
                  <AccountCircleIcon className="navbar-icon" />
                </IconButton>
                <Typography variant="body2" className="navbar-user-name">
                  {user.fullName}
                </Typography>
              </Box>
              <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{ className: "navbar-menu-paper" }}
                transformOrigin={{ horizontal: "right", vertical: "top" }}
                anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              >
                <Box className="navbar-menu-content">
                  <Typography variant="h6" className="navbar-menu-title">
                    Информация о пользователе
                  </Typography>
                  <Divider className="navbar-menu-divider" />
                  <List dense className="navbar-menu-list">
                    <ListItem className="navbar-menu-list-item">
                      <ListItemText
                        primary="Имя пользователя"
                        secondary={user.username}
                        primaryTypographyProps={{
                          className: "navbar-menu-list-item-text-primary",
                        }}
                        secondaryTypographyProps={{
                          className: "navbar-menu-list-item-text-secondary",
                        }}
                      />
                    </ListItem>
                    {user.fullName && (
                      <ListItem className="navbar-menu-list-item">
                        <ListItemText
                          primary="Полное имя"
                          secondary={user.fullName}
                          primaryTypographyProps={{
                            className: "navbar-menu-list-item-text-primary",
                          }}
                          secondaryTypographyProps={{
                            className: "navbar-menu-list-item-text-secondary",
                          }}
                        />
                      </ListItem>
                    )}
                    {user.company && (
                      <ListItem className="navbar-menu-list-item">
                        <ListItemText
                          primary="Компания"
                          secondary={user.company}
                          primaryTypographyProps={{
                            className: "navbar-menu-list-item-text-primary",
                          }}
                          secondaryTypographyProps={{
                            className: "navbar-menu-list-item-text-secondary",
                          }}
                        />
                      </ListItem>
                    )}
                    {user.branch && (
                      <ListItem className="navbar-menu-list-item">
                        <ListItemText
                          primary="Филиал"
                          secondary={user.branch}
                          primaryTypographyProps={{
                            className: "navbar-menu-list-item-text-primary",
                          }}
                          secondaryTypographyProps={{
                            className: "navbar-menu-list-item-text-secondary",
                          }}
                        />
                      </ListItem>
                    )}
                    {user.role && (
                      <ListItem className="navbar-menu-list-item">
                        <ListItemText
                          primary="Роль"
                          secondary={
                            user.role === "admin"
                              ? "Администратор"
                              : user.role === "manager"
                              ? "Менеджер"
                              : "Пользователь"
                          }
                          primaryTypographyProps={{
                            className: "navbar-menu-list-item-text-primary",
                          }}
                          secondaryTypographyProps={{
                            className: "navbar-menu-list-item-text-secondary",
                          }}
                        />
                      </ListItem>
                    )}
                    {user.warehouses && user.warehouses.length > 0 && (
                      <>
                        <ListItem
                          className="navbar-menu-list-item"
                          style={{ paddingTop: "8px" }}
                        >
                          <ListItemText
                            primary="Доступные склады"
                            primaryTypographyProps={{
                              className: "navbar-menu-list-item-text-primary",
                              style: { marginBottom: "8px" },
                            }}
                          />
                        </ListItem>
                        {user.warehouses.map((warehouse, index) => {
                          const address =
                            typeof warehouse === "string"
                              ? warehouse
                              : warehouse.address || "";
                          return (
                            <ListItem
                              key={index}
                              className="navbar-menu-list-item-warehouse"
                            >
                              <ListItemText
                                secondary={address}
                                secondaryTypographyProps={{
                                  className:
                                    "navbar-menu-list-item-warehouse-text",
                                }}
                              />
                            </ListItem>
                          );
                        })}
                      </>
                    )}
                  </List>
                </Box>
                <Divider style={{ borderColor: "#444" }} />
                <MenuItem onClick={handleLogout} className="navbar-menu-logout">
                  <LogoutIcon className="navbar-menu-logout-icon" />
                  Выйти
                </MenuItem>
              </Menu>
            </Box>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
