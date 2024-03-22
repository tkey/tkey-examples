package com.example.tkey_android_mpc.ui.presentation

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.example.tkey_android_mpc.viewmodel.MainViewModel

@Composable
fun LoginScreen(viewModel: MainViewModel) {
   val context = LocalContext.current
   Column(
      modifier = Modifier.fillMaxSize().padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
      horizontalAlignment = Alignment.CenterHorizontally,
   ) {
      Text(
         text = "tKey Android Example",
         textAlign = TextAlign.Center,
         style = MaterialTheme.typography.headlineSmall
      )

      LoginButton {
         try {
            viewModel.loginWithOAuth()
         } catch (e: Exception) {
            Toast.makeText(context, e.localizedMessage, Toast.LENGTH_LONG).show()
         }
      }
   }
}

@Composable
fun LoginButton(onClick: () -> Unit) {
   Button(onClick = { onClick() }) {
      Text("Login with Google")
   }
}
