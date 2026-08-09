import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from './context/PreferencesContext';
import { AuthProvider } from './context/AuthContext';
import { MarketplaceProvider } from './context/MarketplaceContext';
import { CartProvider } from './context/CartContext';

// Layouts
import { PublicLayout } from './layouts/PublicLayout';
import { SellerLayout } from './layouts/SellerLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Auth Guards
import { ProtectedRoute, GuestRoute, RoleRoute } from './components/auth/RouteGuards';

// Auth Pages
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { VerifyPhonePage } from './pages/VerifyPhonePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

// Pages
import { HomePage } from './pages/HomePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { SearchResultsPage } from './pages/SearchResultsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { StorePublicPage } from './pages/StorePublicPage';
import { StoresListPage } from './pages/StoresListPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { TrackingPage } from './pages/TrackingPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ProfilePage } from './pages/ProfilePage';
import { AddressesPage } from './pages/AddressesPage';
import { SecurityPage } from './pages/SecurityPage';
import { WalletPage } from './pages/WalletPage';
import { CouponsPage } from './pages/CouponsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { MessagesPage } from './pages/MessagesPage';
import { ReturnsRefundsPage } from './pages/ReturnsRefundsPage';
import { DisputesPage } from './pages/DisputesPage';
import { HelpCenterPage } from './pages/HelpCenterPage';
import { SellerDashboardPage } from './pages/SellerDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { FRONTEND_FEATURES } from './config/features';
import { FeatureUnavailablePage } from './components/FeatureUnavailablePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <AuthProvider>
          <CartProvider>
          <MarketplaceProvider>
            <BrowserRouter>
              <Routes>
                {/* Guest Auth Routes */}
                <Route
                  path="/login"
                  element={
                    <GuestRoute>
                      <LoginPage />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <GuestRoute>
                      <RegisterPage />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/forgot-password"
                  element={
                    <GuestRoute>
                      <ForgotPasswordPage />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/reset-password"
                  element={
                    <GuestRoute>
                      <ResetPasswordPage />
                    </GuestRoute>
                  }
                />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/verify-phone" element={<VerifyPhonePage />} />

                {/* Public & Buyer Routes */}
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/products" element={<SearchResultsPage />} />
                  <Route path="/products/:id" element={<ProductDetailPage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/categories/:slug" element={<SearchResultsPage />} />
                  <Route path="/search" element={<SearchResultsPage />} />
                  <Route path="/stores" element={<StoresListPage />} />
                  <Route path="/stores/:slug" element={<StorePublicPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/tracking/:id" element={<TrackingPage />} />
                  <Route path="/help-center" element={<HelpCenterPage />} />

                  {/* Protected Buyer Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="/checkout" element={<CheckoutPage />} />
                    <Route path="/orders" element={<MyOrdersPage />} />
                    <Route path="/orders/confirmation" element={<OrderConfirmationPage />} />
                    <Route path="/orders/:id/confirmation" element={<OrderConfirmationPage />} />
                    <Route path="/orders/:id" element={<OrderDetailPage />} />
                    <Route path="/favorites" element={FRONTEND_FEATURES.EXPERIMENTAL_BUYER_FEATURES ? <FavoritesPage /> : <FeatureUnavailablePage title="Funcionalidade em preparação" description="Esta área será liberada quando estiver totalmente conectada aos serviços reais do Mercado Nusali." />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/addresses" element={<AddressesPage />} />
                    <Route path="/security" element={<SecurityPage />} />
                    <Route path="/wallet" element={<WalletPage />} />
                    <Route path="/coupons" element={<CouponsPage />} />
                    <Route path="/notifications" element={FRONTEND_FEATURES.EXPERIMENTAL_BUYER_FEATURES ? <NotificationsPage /> : <FeatureUnavailablePage title="Funcionalidade em preparação" description="Esta área será liberada quando estiver totalmente conectada aos serviços reais do Mercado Nusali." />} />
                    <Route path="/messages" element={FRONTEND_FEATURES.EXPERIMENTAL_BUYER_FEATURES ? <MessagesPage /> : <FeatureUnavailablePage title="Funcionalidade em preparação" description="Esta área será liberada quando estiver totalmente conectada aos serviços reais do Mercado Nusali." />} />
                    <Route path="/returns-refunds" element={FRONTEND_FEATURES.EXPERIMENTAL_BUYER_FEATURES ? <ReturnsRefundsPage /> : <FeatureUnavailablePage title="Funcionalidade em preparação" description="Esta área será liberada quando estiver totalmente conectada aos serviços reais do Mercado Nusali." />} />
                    <Route path="/disputes" element={FRONTEND_FEATURES.EXPERIMENTAL_BUYER_FEATURES ? <DisputesPage /> : <FeatureUnavailablePage title="Funcionalidade em preparação" description="Esta área será liberada quando estiver totalmente conectada aos serviços reais do Mercado Nusali." />} />
                  </Route>
                </Route>

                {/* Seller Routes */}
                <Route
                  element={
                    <RoleRoute allowedRoles={['SELLER', 'ADMIN', 'GLOBAL_ADMIN']}>
                      {FRONTEND_FEATURES.SELLER_PORTAL ? (
                        <SellerLayout />
                      ) : (
                        <FeatureUnavailablePage
                          title="Portal do vendedor em preparação"
                          description="O portal comercial do vendedor ainda não foi liberado neste ambiente."
                        />
                      )}
                    </RoleRoute>
                  }
                >
                  <Route path="/seller" element={<SellerDashboardPage />} />
                  <Route path="/seller/*" element={<SellerDashboardPage />} />
                </Route>

                {/* Admin Routes */}
                <Route
                  element={
                    <RoleRoute allowedRoles={['ADMIN', 'GLOBAL_ADMIN', 'COUNTRY_REPRESENTATIVE', 'REGIONAL_SUPERVISOR']}>
                      {FRONTEND_FEATURES.ADMIN_PORTAL ? (
                        <AdminLayout />
                      ) : (
                        <FeatureUnavailablePage
                          title="Administração em preparação"
                          description="O painel administrativo ainda não foi liberado neste ambiente."
                        />
                      )}
                    </RoleRoute>
                  }
                >
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/*" element={<AdminDashboardPage />} />
                </Route>

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </MarketplaceProvider>
          </CartProvider>
        </AuthProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
