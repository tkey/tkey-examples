package com.example.tkey_android_mpc.di

import android.content.Context
import com.example.tkey_android_mpc.viewmodel.MainViewModel
import org.koin.androidx.viewmodel.dsl.viewModel
import org.koin.dsl.module
import org.torusresearch.customauth.CustomAuth
import org.torusresearch.customauth.types.CustomAuthArgs
import org.torusresearch.fetchnodedetails.types.TorusNetwork

val appModule = module {
    single {
        getCustomAuth(get())
    }

    viewModel { MainViewModel(get()) }
}

private fun getCustomAuth(context: Context): CustomAuth {
    val customAuthArgs = CustomAuthArgs(
        "https://scripts.toruswallet.io/redirect.html",
        TorusNetwork.TESTNET,
        "torusapp://org.torusresearch.customauthandroid/redirect",
    )

    return CustomAuth(customAuthArgs, context)
}