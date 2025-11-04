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
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { logout } from "../features/auth/authSlice";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import logo from "../assets/Rosneft_logo.svg";

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

  return (
    <AppBar
      position="static"
      sx={{
        backgroundColor: "#000000",
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
        padding: "15px 0",
      }}
    >
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            fontWeight: "bold",
            color: "#FED208",
            cursor: "pointer",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
          }}
          onClick={() => navigate("/marketplace")}
        >
          <div className="logo-round" style={{ width: "60px", height: "60px" }}>
            <img src={logo} alt="Rosneft Logo" className="logo-icon" />
          </div>
          Роснефть
        </Typography>
        {user && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: "4px",
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                },
              }}
              onClick={handleClick}
            >
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  backgroundColor: "#FED208",
                  color: "#000",
                  fontSize: "1rem",
                  fontWeight: "bold",
                }}
              >
                {user.username?.charAt(0).toUpperCase() || <PersonIcon />}
              </Avatar>
              <Typography variant="body2" sx={{ color: "#fff" }}>
                {user.username}
              </Typography>
            </Box>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              PaperProps={{
                sx: {
                  backgroundColor: "#2a2a2a",
                  border: "1px solid #444",
                  minWidth: 300,
                  mt: 1,
                },
              }}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography
                  variant="h6"
                  sx={{ color: "#FED208", fontWeight: "bold", mb: 1 }}
                >
                  Информация о пользователе
                </Typography>
                <Divider sx={{ borderColor: "#444", mb: 1 }} />
                <List dense sx={{ py: 0 }}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemText
                      primary="Имя пользователя"
                      secondary={user.username}
                      primaryTypographyProps={{
                        sx: { color: "#aaa", fontSize: "0.875rem" },
                      }}
                      secondaryTypographyProps={{
                        sx: { color: "#fff", fontSize: "1rem" },
                      }}
                    />
                  </ListItem>
                  {user.fullName && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary="Полное имя"
                        secondary={user.fullName}
                        primaryTypographyProps={{
                          sx: { color: "#aaa", fontSize: "0.875rem" },
                        }}
                        secondaryTypographyProps={{
                          sx: { color: "#fff", fontSize: "1rem" },
                        }}
                      />
                    </ListItem>
                  )}
                  {user.company && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary="Компания"
                        secondary={user.company}
                        primaryTypographyProps={{
                          sx: { color: "#aaa", fontSize: "0.875rem" },
                        }}
                        secondaryTypographyProps={{
                          sx: { color: "#fff", fontSize: "1rem" },
                        }}
                      />
                    </ListItem>
                  )}
                  {user.branch && (
                    <ListItem sx={{ px: 0 }}>
                      <ListItemText
                        primary="Филиал"
                        secondary={user.branch}
                        primaryTypographyProps={{
                          sx: { color: "#aaa", fontSize: "0.875rem" },
                        }}
                        secondaryTypographyProps={{
                          sx: { color: "#fff", fontSize: "1rem" },
                        }}
                      />
                    </ListItem>
                  )}
                  {user.role && (
                    <ListItem sx={{ px: 0 }}>
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
                          sx: { color: "#aaa", fontSize: "0.875rem" },
                        }}
                        secondaryTypographyProps={{
                          sx: { color: "#fff", fontSize: "1rem" },
                        }}
                      />
                    </ListItem>
                  )}
                  {user.warehouses && user.warehouses.length > 0 && (
                    <>
                      <ListItem sx={{ px: 0, pt: 1 }}>
                        <ListItemText
                          primary="Доступные склады"
                          primaryTypographyProps={{
                            sx: {
                              color: "#aaa",
                              fontSize: "0.875rem",
                              mb: 1,
                            },
                          }}
                        />
                      </ListItem>
                      {user.warehouses.map((warehouse, index) => {
                        const address = typeof warehouse === 'string' 
                          ? warehouse 
                          : warehouse.address || '';
                        return (
                          <ListItem key={index} sx={{ px: 2, py: 0.5 }}>
                            <ListItemText
                              secondary={address}
                              secondaryTypographyProps={{
                                sx: { color: "#fff", fontSize: "0.875rem" },
                              }}
                            />
                          </ListItem>
                        );
                      })}
                    </>
                  )}
                </List>
              </Box>
              <Divider sx={{ borderColor: "#444" }} />
              <MenuItem
                onClick={handleLogout}
                sx={{
                  color: "#fff",
                  "&:hover": {
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                  },
                }}
              >
                <LogoutIcon sx={{ mr: 1, fontSize: 20 }} />
                Выйти
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
