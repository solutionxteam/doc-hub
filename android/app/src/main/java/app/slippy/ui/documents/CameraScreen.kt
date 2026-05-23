package app.slippy.ui.documents

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import app.slippy.ui.theme.*

enum class CameraMode { SELECT, PREVIEW }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CameraScreen(
    vm: CameraViewModel = hiltViewModel(),
    onDone: () -> Unit
) {
    val state by vm.state.collectAsState()
    val context = LocalContext.current

    // Gallery picker
    val galleryLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? -> uri?.let { vm.setImage(it, context) } }

    // Camera launcher
    val cameraLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success -> if (success) vm.confirmCamera() }

    LaunchedEffect(state.uploadSuccess) {
        if (state.uploadSuccess) {
            kotlinx.coroutines.delay(1200)
            onDone()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (state.mode == CameraMode.SELECT) "เพิ่มเอกสาร" else "ตรวจสอบ") },
                navigationIcon = {
                    if (state.mode == CameraMode.PREVIEW) {
                        IconButton(onClick = { vm.reset() }) {
                            Icon(Icons.Filled.ArrowBack, null)
                        }
                    } else {
                        IconButton(onClick = onDone) {
                            Icon(Icons.Filled.Close, null)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = Background
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (state.mode) {
                CameraMode.SELECT -> SelectModeContent(
                    onCamera  = { uri -> cameraLauncher.launch(uri) },
                    onGallery = { galleryLauncher.launch("image/*") },
                    onPdf     = { galleryLauncher.launch("application/pdf") },
                    vm        = vm,
                    context   = context
                )
                CameraMode.PREVIEW -> PreviewModeContent(
                    state  = state,
                    onUpload = { vm.upload(context) },
                    onReset  = { vm.reset() }
                )
            }
        }
    }
}

@Composable
private fun SelectModeContent(
    onCamera: (Uri) -> Unit,
    onGallery: () -> Unit,
    onPdf: () -> Unit,
    vm: CameraViewModel,
    context: android.content.Context
) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("เลือกวิธีอัพโหลด", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        Spacer(Modifier.height(24.dp))

        UploadOptionCard(
            icon    = Icons.Filled.CameraAlt,
            title   = "กล้องถ่ายรูป",
            bgColor = Brand500,
            onClick = { onCamera(vm.createImageUri(context)) }
        )
        Spacer(Modifier.height(12.dp))
        UploadOptionCard(
            icon    = Icons.Filled.PhotoLibrary,
            title   = "คลังภาพ",
            bgColor = StatusApproved,
            onClick = onGallery
        )
        Spacer(Modifier.height(12.dp))
        UploadOptionCard(
            icon    = Icons.Filled.PictureAsPdf,
            title   = "ไฟล์ PDF",
            bgColor = StatusReviewing,
            onClick = onPdf
        )
    }
}

@Composable
private fun UploadOptionCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    bgColor: Color,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape    = RoundedCornerShape(18.dp),
        colors   = CardDefaults.cardColors(containerColor = SurfaceWhite),
        border   = androidx.compose.foundation.BorderStroke(1.dp, BorderColor)
    ) {
        Row(
            Modifier.padding(18.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(
                Modifier.size(52.dp).background(bgColor, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center
            ) { Icon(icon, null, tint = Color.White, modifier = Modifier.size(26.dp)) }
            Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary,
                modifier = Modifier.weight(1f))
            Icon(Icons.Filled.ChevronRight, null, tint = TextSecondary)
        }
    }
}

@Composable
private fun PreviewModeContent(
    state  : CameraUiState,
    onUpload: () -> Unit,
    onReset: () -> Unit
) {
    Column(Modifier.fillMaxSize().padding(20.dp)) {
        state.imageUri?.let { uri ->
            AsyncImage(
                model = uri,
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .background(SurfaceMuted, RoundedCornerShape(16.dp))
            )
        } ?: Box(Modifier.fillMaxWidth().weight(1f).background(SurfaceMuted, RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center) {
            Icon(Icons.Filled.Description, null, tint = BorderColor, modifier = Modifier.size(64.dp))
        }

        Spacer(Modifier.height(16.dp))

        state.error?.let { err ->
            Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp),
                color = StatusFailed.copy(0.08f)) {
                Text(err, color = StatusFailed, fontSize = 13.sp, modifier = Modifier.padding(12.dp))
            }
            Spacer(Modifier.height(8.dp))
        }

        if (state.uploadSuccess) {
            Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp),
                color = StatusApproved.copy(0.08f)) {
                Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Filled.CheckCircle, null, tint = StatusApproved, modifier = Modifier.size(16.dp))
                    Text("อัพโหลดสำเร็จ! AI กำลังประมวลผล…",
                        color = StatusApproved, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
            }
            Spacer(Modifier.height(8.dp))
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            OutlinedButton(onClick = onReset, modifier = Modifier.weight(1f).height(52.dp),
                shape = RoundedCornerShape(14.dp)) {
                Text("เลือกใหม่", fontWeight = FontWeight.Bold)
            }
            Button(
                onClick   = onUpload,
                enabled   = !state.isUploading && !state.uploadSuccess,
                modifier  = Modifier.weight(1f).height(52.dp),
                shape     = RoundedCornerShape(14.dp),
                colors    = ButtonDefaults.buttonColors(containerColor = Brand500)
            ) {
                if (state.isUploading)
                    CircularProgressIndicator(Modifier.size(20.dp), color = Color.White)
                else
                    Text("อัพโหลด", fontWeight = FontWeight.Bold)
            }
        }
    }
}
