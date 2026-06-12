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
import TableList from "views/admin/TableList.js";
import WasteManagement from "views/admin/WasteManagement.js";
import Icons from "views/admin/Icons.js";
import Maps from "views/admin/Maps.js";
import Notifications from "views/admin/Notifications.js";
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
    path: "/table",
    name: "Petugas",
    icon: "nc-icon nc-notes",
    component: TableList,
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
    path: "/icons",
    name: "Transaksi",
    icon: "nc-icon nc-atom",
    component: Icons,
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
    path: "/notifications",
    name: "Pengaturan",
    icon: "nc-icon nc-bell-55",
    component: Notifications,
    layout: "/admin"
  }
];

export default dashboardRoutes;
