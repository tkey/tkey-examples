package com.example.tkey_android_mpc.ui.presentation
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import com.example.tkey_android_mpc.viewmodel.MainViewModel

@Composable
fun MainScreen(viewModel: MainViewModel) {
    val isLoggedIn = viewModel.isLoggedIn.collectAsState()
    if (!isLoggedIn.value) {
        return LoginScreen(viewModel)
    }
}