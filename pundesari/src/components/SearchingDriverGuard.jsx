import React, { useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useOrder } from '../context/OrderContext';

const SearchingDriverGuard = ({ children }) => {
  const history = useHistory();
  const location = useLocation();
  const { orderFlowState, ORDER_FLOW } = useOrder();

  useEffect(() => {
    if (orderFlowState !== ORDER_FLOW.SEARCHING_DRIVER) return;
    if (location.pathname !== '/user/find-driver') {
      history.replace('/user/find-driver');
    }
  }, [history, location.pathname, orderFlowState, ORDER_FLOW]);

  return <>{children}</>;
};

export default SearchingDriverGuard;
