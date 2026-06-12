/*!

=========================================================
* Light Bootstrap Dashboard React - v2.0.1
=========================================================

* Product Page: https://www.creative-tim.com/product/light-bootstrap-dashboard-react
* Copyright 2022 Creative Tim (https://www.creative-tim.com)
* Licensed under MIT (https://github.com/creativetimofficial/light-bootstrap-dashboard-react/blob/master/LICENSE.md)

* Coded by Creative Tim

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import Dashboard from "views/admin/Dashboard.js";
import UserProfile from "views/admin/UserProfile.js";
import Petugas from "views/admin/Petugas.js";
import WasteManagement from "views/admin/WasteManagement.js";
import Transaksi from "views/admin/Transaksi.js";
import Maps from "views/admin/Maps.js";
import Pengaturan from "views/admin/Pengaturan.js";
import Saldo from "views/admin/SaldoAdmin.js";
import MarketplaceAdmin from "views/admin/MarketplaceAdmin.js";



const dashboardRoutes = [
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "nc-icon nc-chart-pie-35",
    component: Dashboard,
    layout: "/admin"
  },
  {
    path: "/user",
    name: "Customer", 
    icon: "nc-icon nc-circle-09",
    component: UserProfile,
    layout: "/admin"
  },
  {
    path: "/petugas",
    name: "Petugas",
    icon: "nc-icon nc-notes",
    component: Petugas,
    layout: "/admin"
  },
  {
    path: "/waste-management",
    name: "Harga Sampah",
    icon: "nc-icon nc-paper-2",
    component: WasteManagement,
    layout: "/admin"
  },
  {
    path: "/Transaksi",
    name: "Transaksi",
    icon: "nc-icon nc-atom",
    component: Transaksi,
    layout: "/admin"
  },
  // {
  //   path: "/maps",
  //   name: "Status Transaksi",
  //   icon: "nc-icon nc-pin-3",
  //   component: Maps,
  //   layout: "/admin"
  // },
{
  path: "/saldo",
  name: "Saldo",
  icon: "nc-icon nc-money-coins",
  component: Saldo,
  layout: "/admin"
},
  {
    path: "/marketplace",
    name: "Marketplace",
    icon: "nc-icon nc-cart-simple",
    component: MarketplaceAdmin,
    layout: "/admin"
  },
  {
    path: "/Pengaturan",
    name: "Pengaturan",
    icon: "nc-icon nc-bell-55",
    component: Pengaturan,
    layout: "/admin"
  }
];

export default dashboardRoutes;
