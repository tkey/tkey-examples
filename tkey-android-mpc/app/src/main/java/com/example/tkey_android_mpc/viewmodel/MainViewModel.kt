package com.example.tkey_android_mpc.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import org.torusresearch.customauth.CustomAuth
import org.torusresearch.customauth.types.LoginType
import org.torusresearch.customauth.types.SubVerifierDetails
import org.torusresearch.customauth.types.TorusLoginResponse

@OptIn(ExperimentalStdlibApi::class)
class MainViewModel(private val customAuth: CustomAuth) : ViewModel() {
    private val _isLoggedIn: MutableStateFlow<Boolean> = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn


    fun loginWithOAuth() {
        val allowedBrowsers = arrayOf(
            "com.android.chrome",  // Chrome stable
            "com.google.android.apps.chrome",  // Chrome system
            "com.android.chrome.beta"
        )
        val subVerifierDetails = SubVerifierDetails(LoginType.GOOGLE, "web3auth-google-example", "774338308167-q463s7kpvja16l4l0kko3nb925ikds2p.apps.googleusercontent.com").setPreferCustomTabs(true).setAllowedBrowsers(allowedBrowsers)
        viewModelScope.launch {
            try {
                val loginCompletableFuture =  customAuth.triggerLogin(subVerifierDetails)
                val value: TorusLoginResponse = loginCompletableFuture.await()
                print(value.userInfo)
                _isLoggedIn.emit(true)
            } catch (error: Exception) {
                throw error
            }

        }

    }
}